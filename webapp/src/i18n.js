/**
 * i18n 국제화 설정
 * React-i18next를 사용한 한국어/영어 지원
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 한국어 번역 리소스
const koResources = {
  translation: {
    // Quick Actions
    quickActions: {
      title: "빠른 작업",
      refreshAll: "모두 새로고침",
      terminal: "터미널",
      exportLogs: "로그 내보내기",
      settings: "설정"
    },
    
    // Dashboard
    dashboard: {
      title: "MCP 인프라 대시보드",
      description: "실시간으로 MCP 서비스를 모니터링하고 관리하세요",
      systemOverview: "시스템 개요",
      totalServices: "전체 서비스",
      healthyServices: "정상 서비스", 
      issues: "문제",
      systemHealth: "시스템 상태",
      services: "서비스",
      searchPlaceholder: "서비스 검색...",
      sortBy: "정렬 기준:",
      name: "이름",
      status: "상태",
      toolCount: "도구 수",
      noServicesFound: "조건에 맞는 서비스를 찾을 수 없습니다",
      allServices: "모든 서비스",
      development: "개발",
      aiTools: "AI/ML",
      infrastructure: "인프라",
      dataProcessing: "데이터",
      monitoring: "모니터링",
      communication: "통신",
      security: "보안",
      other: "기타",
      response: "응답",
      memory: "메모리",
      tools: "도구",
      view: "보기",
      logs: "로그",
      degraded: "성능저하",
      uptime: "가동시간",
      systemLoad: "시스템 부하",
      loadingSystemStatus: "시스템 상태를 불러오는 중...",
      serviceResponse: "서비스 응답",
      serviceMetrics: "서비스 메트릭",
      error: "오류",
      availableTools: "사용 가능한 도구",
      memoryUsage: "메모리 사용량",
      currentUsage: "현재 사용량",
      cpuUsage: "CPU 사용량",
      responseTime: "응답 시간",
      noMetricsAvailable: "메트릭 정보가 없습니다"
    },
    
    // Recent Events
    recentEvents: {
      title: "최근 이벤트",
      noEvents: "최근 이벤트 없음",
      allSystemsNormal: "모든 시스템이 정상적으로 작동 중입니다",
      source: "출처",
      acknowledge: "확인",
      viewAll: "모든 이벤트 보기"
    },
    
    // 공통 UI
    common: {
      loading: "로딩 중...",
      error: "오류",
      success: "성공",
      cancel: "취소",
      confirm: "확인",
      close: "닫기",
      save: "저장",
      edit: "편집",
      delete: "삭제",
      refresh: "새로고침",
      search: "검색",
      filter: "필터",
      sort: "정렬"
    },
    
    // 상태 메시지
    status: {
      healthy: "정상",
      unhealthy: "비정상", 
      loading: "로딩 중",
      error: "오류",
      offline: "오프라인",
      connecting: "연결 중"
    },
    
    // 알림 메시지
    notifications: {
      refreshSuccess: "모든 서비스가 성공적으로 새로고침되었습니다",
      refreshError: "서비스 새로고침 중 오류가 발생했습니다",
      exportSuccess: "로그가 성공적으로 내보내졌습니다",
      exportError: "로그 내보내기 중 오류가 발생했습니다",
      settingsUpdated: "설정이 업데이트되었습니다"
    }
  }
};

// 영어 번역 리소스
const enResources = {
  translation: {
    // Quick Actions
    quickActions: {
      title: "Quick Actions",
      refreshAll: "Refresh All",
      terminal: "Terminal", 
      exportLogs: "Export Logs",
      settings: "Settings"
    },
    
    // Dashboard
    dashboard: {
      title: "MCP Infrastructure Dashboard",
      description: "Monitor and manage MCP services in real-time",
      systemOverview: "System Overview",
      totalServices: "Total Services",
      healthyServices: "Healthy Services",
      issues: "Issues", 
      systemHealth: "System Health",
      services: "Services",
      searchPlaceholder: "Search services...",
      sortBy: "Sort by:",
      name: "Name",
      status: "Status",
      toolCount: "Tool Count",
      noServicesFound: "No services found matching your criteria",
      allServices: "All Services",
      development: "Development",
      aiTools: "AI/ML",
      infrastructure: "Infrastructure",
      dataProcessing: "Data",
      monitoring: "Monitoring",
      communication: "Communication",
      security: "Security",
      other: "Other",
      response: "Response",
      memory: "Memory",
      tools: "Tools",
      view: "View",
      logs: "Logs",
      degraded: "Degraded",
      uptime: "Uptime",
      systemLoad: "System Load",
      loadingSystemStatus: "Loading system status...",
      serviceResponse: "Service Response",
      serviceMetrics: "Service Metrics",
      error: "Error",
      availableTools: "Available Tools",
      memoryUsage: "Memory Usage",
      currentUsage: "Current Usage",
      cpuUsage: "CPU Usage",
      responseTime: "Response Time",
      noMetricsAvailable: "No metrics information available"
    },
    
    // Recent Events
    recentEvents: {
      title: "Recent Events",
      noEvents: "No recent events",
      allSystemsNormal: "All systems are operating normally",
      source: "Source",
      acknowledge: "Acknowledge",
      viewAll: "View all events"
    },
    
    // 공통 UI
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success", 
      cancel: "Cancel",
      confirm: "Confirm",
      close: "Close",
      save: "Save",
      edit: "Edit", 
      delete: "Delete",
      refresh: "Refresh",
      search: "Search",
      filter: "Filter",
      sort: "Sort"
    },
    
    // 상태 메시지
    status: {
      healthy: "Healthy",
      unhealthy: "Unhealthy",
      loading: "Loading", 
      error: "Error",
      offline: "Offline",
      connecting: "Connecting"
    },
    
    // 알림 메시지
    notifications: {
      refreshSuccess: "All services refreshed successfully",
      refreshError: "Error occurred while refreshing services",
      exportSuccess: "Logs exported successfully", 
      exportError: "Error occurred while exporting logs",
      settingsUpdated: "Settings updated"
    }
  }
};

i18n
  .use(LanguageDetector) // 브라우저 언어 자동 감지
  .use(initReactI18next) // React-i18next 초기화
  .init({
    // 번역 리소스
    resources: {
      ko: koResources,
      en: enResources
    },
    
    // 기본 언어 설정
    fallbackLng: 'en', // 감지된 언어가 없을 때 기본 언어
    lng: undefined, // LanguageDetector가 자동으로 감지
    
    // 브라우저 언어 감지 설정
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    
    // 보간 설정
    interpolation: {
      escapeValue: false, // React는 기본적으로 XSS 방지
    },
    
    // 개발 모드 설정
    debug: process.env.NODE_ENV === 'development',
    
    // 네임스페이스 설정
    defaultNS: 'translation',
    ns: ['translation'],
  });

export default i18n;