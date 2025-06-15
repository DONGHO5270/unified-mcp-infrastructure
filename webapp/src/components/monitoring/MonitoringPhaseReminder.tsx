// ============================================================================
// Phase 2, 3 리마인더 컴포넌트 - 대시보드에 항상 표시
// ============================================================================

import React from 'react';
import { AlertTriangle, CheckCircle, Settings } from 'lucide-react';

interface PhaseStatus {
  phase: number;
  name: string;
  status: 'completed' | 'skeleton' | 'not-started';
  description: string;
  todoFile?: string;
}

export const MonitoringPhaseReminder: React.FC = () => {
  const phases: PhaseStatus[] = [
    {
      phase: 1,
      name: '기본 모니터링',
      status: 'completed',
      description: '실시간 메트릭, 헬스체크, 알림 - 100% 구현 완료'
    },
    {
      phase: 2,
      name: '예측 분석',
      status: 'skeleton',
      description: '시계열 예측, 이상 탐지 - 스켈레톤 구현 (Mock 데이터)',
      todoFile: 'PredictiveAnalyzer.ts'
    },
    {
      phase: 3,
      name: 'AI 최적화',
      status: 'skeleton',
      description: '가중치 조정, 자동 스케일링 - 스켈레톤 구현 (Mock 알고리즘)',
      todoFile: 'WeightAdjuster.ts'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'skeleton':
        return <Settings className="h-5 w-5 text-yellow-500 animate-pulse" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'skeleton':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center mb-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Phase 구현 상태 리마인더
          </h3>
        </div>

        <div className="space-y-2">
          {phases.map((phase) => (
            <div
              key={phase.phase}
              className={`p-2 rounded border ${getStatusColor(phase.status)}`}
            >
              <div className="flex items-start">
                <div className="mr-2 mt-0.5">{getStatusIcon(phase.status)}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    Phase {phase.phase}: {phase.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {phase.description}
                  </div>
                  {phase.todoFile && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      TODO: {phase.todoFile}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <a
            href="/MONITORING-TODO-PHASE2-3.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            📋 상세 구현 가이드 보기
          </a>
        </div>

        <button
          onClick={() => {
            // localStorage에 숨김 상태 저장
            const hideUntil = Date.now() + 24 * 60 * 60 * 1000; // 24시간
            localStorage.setItem('hidePhaseReminder', hideUntil.toString());
            window.location.reload();
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="24시간 동안 숨기기"
        >
          ×
        </button>
      </div>
    </div>
  );
};

// 숨김 상태 체크 HOC
export const MonitoringPhaseReminderWithHide: React.FC = () => {
  const [isHidden, setIsHidden] = React.useState(true);

  React.useEffect(() => {
    const hideUntil = localStorage.getItem('hidePhaseReminder');
    if (!hideUntil || Date.now() > parseInt(hideUntil)) {
      setIsHidden(false);
      localStorage.removeItem('hidePhaseReminder');
    }
  }, []);

  if (isHidden) return null;

  return <MonitoringPhaseReminder />;
};