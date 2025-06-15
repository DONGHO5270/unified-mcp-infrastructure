from pathlib import Path

_repo_root_path = Path(__file__).parent.parent.parent.resolve()

REPO_ROOT = str(_repo_root_path)
PROMPT_TEMPLATES_DIR = str(_repo_root_path / "config" / "prompt_templates")
CONTEXT_YAMLS_DIR = str(_repo_root_path / "config" / "contexts")
MODE_YAMLS_DIR = str(_repo_root_path / "config" / "modes")

SERENA_MANAGED_DIR_NAME = ".serena"

DEFAULT_CONTEXT = "desktop-app"
DEFAULT_MODES = ("interactive", "editing")

PROJECT_TEMPLATE_FILE = str(_repo_root_path / "project.template.yml")
