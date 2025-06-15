import os
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import NamedTuple

import pathspec
from pathspec import PathSpec


class ScanResult(NamedTuple):
    """Result of scanning a directory."""

    directories: list[str]
    files: list[str]


def scan_directory(
    path: str,
    recursive: bool = False,
    relative_to: str | None = None,
    is_ignored_dir: Callable[[str], bool] = lambda x: False,
    is_ignored_file: Callable[[str], bool] = lambda x: False,
) -> ScanResult:
    """
    :param path: the path to scan
    :param recursive: whether to recursively scan subdirectories
    :param relative_to: the path to which the results should be relative to; if None, provide absolute paths
    :param is_ignored_dir: a function with which to determine whether the given directory (abs. path) shall be ignored
    :param is_ignored_file: a function with which to determine whether the given file (abs. path) shall be ignored
    :return: the list of directories and files
    """
    files = []
    directories = []

    abs_path = os.path.abspath(path)
    rel_base = os.path.abspath(relative_to) if relative_to else None

    with os.scandir(abs_path) as entries:
        for entry in entries:
            entry_path = entry.path

            if rel_base:
                result_path = os.path.relpath(entry_path, rel_base)
            else:
                result_path = entry_path

            if entry.is_file():
                if not is_ignored_file(entry_path):
                    files.append(result_path)
            elif entry.is_dir():
                if not is_ignored_dir(entry_path):
                    directories.append(result_path)
                    if recursive:
                        sub_result = scan_directory(
                            entry_path,
                            recursive=True,
                            relative_to=relative_to,
                            is_ignored_dir=is_ignored_dir,
                            is_ignored_file=is_ignored_file,
                        )
                        files.extend(sub_result.files)
                        directories.extend(sub_result.directories)

    return ScanResult(directories, files)


def find_all_non_ignored_files(repo_root: str) -> list[str]:
    """
    Find all non-ignored files in the repository, respecting all gitignore files in the repository.

    :param repo_root: The root directory of the repository
    :return: A list of all non-ignored files in the repository
    """
    gitignore_parser = GitignoreParser(repo_root)
    _, files = scan_directory(repo_root, recursive=True)
    return [file for file in files if not gitignore_parser.should_ignore(file)]


@dataclass
class GitignoreSpec:
    """
    Represents a single gitignore file and its parsed patterns.

    :param file_path: Path to the gitignore file
    :param patterns: List of adjusted patterns from the gitignore file
    :param pathspec: Compiled PathSpec object for pattern matching
    """

    file_path: str
    patterns: list[str] = field(default_factory=list)
    pathspec: PathSpec = field(init=False)

    def __post_init__(self) -> None:
        """Initialize the PathSpec from patterns."""
        self.pathspec = PathSpec.from_lines(pathspec.patterns.GitWildMatchPattern, self.patterns)

    def matches(self, path: str) -> bool:
        """
        Check if the given path matches any pattern in this gitignore spec.

        :param path: Path to check (should be relative to repo root)
        :return: True if path matches any pattern
        """
        return self.pathspec.match_file(path)


class GitignoreParser:
    """
    Parser for gitignore files in a repository.

    This class handles parsing multiple gitignore files throughout a repository
    and provides methods to check if paths should be ignored.
    """

    def __init__(self, repo_root: str) -> None:
        """
        Initialize the parser for a repository.

        :param repo_root: Root directory of the repository
        """
        self.repo_root = os.path.abspath(repo_root)
        self.ignore_specs: list[GitignoreSpec] = []
        self._load_gitignore_files()

    def _load_gitignore_files(self) -> None:
        """Load all gitignore files from the repository."""
        gitignore_files = self._find_gitignore_files()

        for gitignore_file in gitignore_files:
            spec = self._create_ignore_spec(gitignore_file)
            if spec.patterns:  # Only add non-empty specs
                self.ignore_specs.append(spec)

    def _find_gitignore_files(self) -> list[str]:
        """
        Find all .gitignore files in the repository.

        :return: List of absolute paths to .gitignore files
        """
        gitignore_files = []

        for root, dirs, files in os.walk(self.repo_root):
            # Skip .git directory
            if ".git" in dirs:
                dirs.remove(".git")

            if ".gitignore" in files:
                gitignore_path = os.path.join(root, ".gitignore")
                gitignore_files.append(gitignore_path)

        return gitignore_files

    def _create_ignore_spec(self, gitignore_file_path: str) -> GitignoreSpec:
        """
        Create a GitignoreSpec from a single gitignore file.

        :param gitignore_file_path: Path to the .gitignore file
        :return: GitignoreSpec object for the gitignore patterns
        """
        try:
            with open(gitignore_file_path, encoding="utf-8") as f:
                content = f.read()
        except (OSError, UnicodeDecodeError):
            # If we can't read the file, return an empty spec
            return GitignoreSpec(gitignore_file_path, [])

        gitignore_dir = os.path.dirname(gitignore_file_path)
        patterns = self._parse_gitignore_content(content, gitignore_dir)

        return GitignoreSpec(gitignore_file_path, patterns)

    def _parse_gitignore_content(self, content: str, gitignore_dir: str) -> list[str]:
        """
        Parse gitignore content and adjust patterns based on the gitignore file location.

        :param content: Content of the .gitignore file
        :param gitignore_dir: Directory containing the .gitignore file (absolute path)
        :return: List of adjusted patterns
        """
        patterns = []

        # Get the relative path from repo root to the gitignore directory
        rel_dir = os.path.relpath(gitignore_dir, self.repo_root)
        if rel_dir == ".":
            rel_dir = ""

        for line in content.splitlines():
            # Strip trailing whitespace (but preserve leading whitespace for now)
            line = line.rstrip()

            # Skip empty lines and comments
            if not line or line.lstrip().startswith("#"):
                continue

            # Handle escaped characters at the beginning
            if line.startswith(("\\#", "\\!")):
                line = line[1:]

            # Store whether this is a negation pattern
            is_negation = line.startswith("!")
            if is_negation:
                line = line[1:]

            # Strip leading/trailing whitespace after removing negation
            line = line.strip()

            if not line:
                continue

            # Determine if pattern is anchored to the gitignore directory
            is_anchored = "/" in line[:-1] or line.startswith("/")

            # Remove leading slash for processing
            if line.startswith("/"):
                line = line[1:]

            # Adjust pattern based on gitignore file location
            if rel_dir:
                if is_anchored:
                    # Anchored patterns are relative to the gitignore directory
                    adjusted_pattern = os.path.join(rel_dir, line)
                else:
                    # Non-anchored patterns can match anywhere below the gitignore directory
                    # We need to preserve this behavior
                    if line.startswith("**/"):
                        adjusted_pattern = line
                    else:
                        # Add the directory prefix but also allow matching in subdirectories
                        adjusted_pattern = os.path.join(rel_dir, "**", line)
            else:
                adjusted_pattern = line

            # Re-add negation if needed
            if is_negation:
                adjusted_pattern = "!" + adjusted_pattern

            # Normalize path separators to forward slashes (gitignore uses forward slashes)
            adjusted_pattern = adjusted_pattern.replace(os.sep, "/")

            patterns.append(adjusted_pattern)

        return patterns

    def should_ignore(self, path: str) -> bool:
        """
        Check if a path should be ignored based on the gitignore rules.

        :param path: Path to check (absolute or relative to repo_root)
        :return: True if the path should be ignored, False otherwise
        """
        # Convert to relative path from repo root
        if os.path.isabs(path):
            rel_path = os.path.relpath(path, self.repo_root)
        else:
            rel_path = path

        # Normalize path separators
        rel_path = rel_path.replace(os.sep, "/")

        # Check against each ignore spec
        for spec in self.ignore_specs:
            if spec.matches(rel_path):
                return True

        return False

    def get_ignore_specs(self) -> list[GitignoreSpec]:
        """
        Get all loaded gitignore specs.

        :return: List of GitignoreSpec objects
        """
        return self.ignore_specs

    def reload(self) -> None:
        """Reload all gitignore files from the repository."""
        self.ignore_specs.clear()
        self._load_gitignore_files()
