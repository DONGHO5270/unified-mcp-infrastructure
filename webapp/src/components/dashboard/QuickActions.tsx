import React, { useState, useCallback } from 'react';
import { RefreshCw, Settings, Terminal, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useServiceStore } from '../../stores';

interface QuickActionsProps {
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { fetchServices, fetchMetrics, services, metrics } = useServiceStore();
  
  const [loading, setLoading] = useState({
    refresh: false,
    export: false,
    terminal: false,
    settings: false
  });

  // 모든 서비스 새로고침
  const handleRefreshAll = useCallback(async () => {
    if (loading.refresh) return;
    
    setLoading(prev => ({ ...prev, refresh: true }));
    
    try {
      console.log('[QuickActions] 모든 서비스 새로고침 시작...');
      
      // 병렬로 서비스 목록과 메트릭 새로고침
      await Promise.all([
        fetchServices(),
        fetchMetrics()
      ]);
      
      console.log('[QuickActions] 모든 서비스 새로고침 완료');
      
      // 성공 알림 (향후 토스트 알림으로 대체 가능)
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            type: 'success',
            message: t('notifications.refreshSuccess')
          }
        }));
      }
      
    } catch (error) {
      console.error('[QuickActions] 서비스 새로고침 실패:', error);
      
      // 에러 알림
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            type: 'error', 
            message: t('notifications.refreshError')
          }
        }));
      }
    } finally {
      setLoading(prev => ({ ...prev, refresh: false }));
    }
  }, [loading.refresh, fetchServices, fetchMetrics, t]);

  // 터미널 모달 열기
  const handleOpenTerminal = useCallback(() => {
    if (loading.terminal) return;
    
    setLoading(prev => ({ ...prev, terminal: true }));
    
    try {
      console.log('[QuickActions] 터미널 모달 열기...');
      
      // CLI Prompt 모달 열기 이벤트 발송
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('open-cli-prompt'));
      }
      
    } catch (error) {
      console.error('[QuickActions] 터미널 모달 열기 실패:', error);
    } finally {
      setLoading(prev => ({ ...prev, terminal: false }));
    }
  }, [loading.terminal]);

  // 로그 내보내기
  const handleExportLogs = useCallback(async () => {
    if (loading.export) return;
    
    setLoading(prev => ({ ...prev, export: true }));
    
    try {
      console.log('[QuickActions] 로그 내보내기 시작...');
      
      // 현재 서비스 상태와 메트릭 데이터 수집
      const exportData = {
        timestamp: new Date().toISOString(),
        services: services || [],
        metrics: metrics || {},
        systemInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          url: window.location.href
        }
      };
      
      // JSON 파일로 다운로드
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { 
        type: 'application/json;charset=utf-8' 
      });
      
      // 파일명에 타임스탬프 포함
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `mcp-logs-${timestamp}.json`;
      
      // 다운로드 링크 생성 및 클릭
      const downloadUrl = URL.createObjectURL(dataBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 메모리 누수 방지를 위해 URL 해제
      URL.revokeObjectURL(downloadUrl);
      
      console.log(`[QuickActions] 로그 파일 다운로드 완료: ${filename}`);
      
      // 성공 알림
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            type: 'success',
            message: t('notifications.exportSuccess')
          }
        }));
      }
      
    } catch (error) {
      console.error('[QuickActions] 로그 내보내기 실패:', error);
      
      // 에러 알림
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            type: 'error',
            message: t('notifications.exportError')
          }
        }));
      }
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  }, [loading.export, services, metrics, t]);

  // 설정 페이지 열기
  const handleOpenSettings = useCallback(() => {
    if (loading.settings) return;
    
    setLoading(prev => ({ ...prev, settings: true }));
    
    try {
      console.log('[QuickActions] 설정 페이지로 이동...');
      
      // 설정 모달 열기 이벤트 발송 (향후 설정 페이지 구현 시)
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('open-settings'));
      }
      
      // 임시로 브라우저 설정 알림
      alert('설정 페이지가 곧 구현될 예정입니다.\n\n현재 브라우저 설정에서 언어를 변경할 수 있습니다.');
      
    } catch (error) {
      console.error('[QuickActions] 설정 페이지 열기 실패:', error);
    } finally {
      setLoading(prev => ({ ...prev, settings: false }));
    }
  }, [loading.settings]);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('quickActions.title')}
      </h2>
      
      <div className="grid grid-cols-2 gap-3">
        {/* 모두 새로고침 버튼 */}
        <button
          onClick={handleRefreshAll}
          disabled={loading.refresh}
          className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={t('quickActions.refreshAll')}
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${loading.refresh ? 'animate-spin' : ''}`} />
          {loading.refresh ? t('common.loading') : t('quickActions.refreshAll')}
        </button>

        {/* 터미널 버튼 */}
        <button
          onClick={handleOpenTerminal}
          disabled={loading.terminal}
          className="flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label={t('quickActions.terminal')}
        >
          <Terminal className="h-5 w-5 mr-2" />
          {t('quickActions.terminal')}
        </button>

        {/* 로그 내보내기 버튼 */}
        <button
          onClick={handleExportLogs}
          disabled={loading.export}
          className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          aria-label={t('quickActions.exportLogs')}
        >
          <Download className="h-5 w-5 mr-2" />
          {loading.export ? t('common.loading') : t('quickActions.exportLogs')}
        </button>

        {/* 설정 버튼 */}
        <button
          onClick={handleOpenSettings}
          disabled={loading.settings}
          className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          aria-label={t('quickActions.settings')}
        >
          <Settings className="h-5 w-5 mr-2" />
          {t('quickActions.settings')}
        </button>
      </div>
    </div>
  );
};