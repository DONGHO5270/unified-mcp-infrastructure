import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../layouts/MainLayout';
import { 
  TrendingUp, 
  AlertTriangle, 
  Activity, 
  ChevronLeft,
  Clock,
  Zap,
  BarChart3,
  Info
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface PredictionData {
  nextHourPrediction: {
    expectedLoad: number;
    confidence: number;
    changeFromCurrent: string;
  };
  anomalyDetection: {
    probability: number;
    potentialIssues: Array<{
      service: string;
      probability: number;
      description: string;
      suggestedAction: string;
    }>;
  };
  trends: {
    performance: string;
    usage: string;
    errors: string;
  };
  recommendations: string[];
}

const PredictiveAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictiveAnalysis();
  }, []);

  const fetchPredictiveAnalysis = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/monitoring/predictive/details');
      
      if (!response.ok) {
        throw new Error('Failed to fetch predictive analysis');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setPredictionData(result.data);
      } else {
        // 임시 데이터 (API가 아직 구현되지 않은 경우)
        setPredictionData({
          nextHourPrediction: {
            expectedLoad: 67,
            confidence: 85,
            changeFromCurrent: '+12%'
          },
          anomalyDetection: {
            probability: 13,
            potentialIssues: [
              {
                service: 'npm-sentinel',
                probability: 73,
                description: '15:30경 응답시간 지연 가능성',
                suggestedAction: '캐시 사전 워밍업 권장'
              },
              {
                service: 'vercel',
                probability: 45,
                description: '17:00경 트래픽 급증 가능성',
                suggestedAction: '스케일링 대기 모드 활성화'
              }
            ]
          },
          trends: {
            performance: 'improving',
            usage: 'stable',
            errors: 'improving'
          },
          recommendations: [
            'npm-sentinel 서비스 모니터링 간격을 30초에서 15초로 단축',
            'vercel 서비스 캐시 TTL을 45분으로 연장',
            '오후 시간대 자동 스케일링 정책 활성화'
          ]
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // 오류 시에도 임시 데이터 표시
      setPredictionData({
        nextHourPrediction: { expectedLoad: 67, confidence: 85, changeFromCurrent: '+12%' },
        anomalyDetection: {
          probability: 13,
          potentialIssues: [
            {
              service: 'npm-sentinel',
              probability: 73,
              description: '15:30경 응답시간 지연 가능성',
              suggestedAction: '캐시 사전 워밍업 권장'
            }
          ]
        },
        trends: { performance: 'improving', usage: 'stable', errors: 'improving' },
        recommendations: ['npm-sentinel 서비스 모니터링 간격을 30초에서 15초로 단축']
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 차트용 모의 데이터 생성
  const generateChartData = () => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => ({
      time: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString().slice(11, 16),
      load: Math.floor(Math.random() * 30) + 40,
      predicted: i >= 20 ? Math.floor(Math.random() * 20) + 60 : null
    }));
  };

  const chartData = generateChartData();

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'worsening':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            대시보드로 돌아가기
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            예측 분석 상세 정보
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            AI 기반 시스템 성능 예측 및 이상 징후 탐지
          </p>
        </div>

        {predictionData && (
          <>
            {/* 주요 지표 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* 다음 시간 예상 부하 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    다음 시간 예상 부하
                  </h3>
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {predictionData.nextHourPrediction.expectedLoad}%
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    현재 대비 {predictionData.nextHourPrediction.changeFromCurrent}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    신뢰도 {predictionData.nextHourPrediction.confidence}%
                  </span>
                </div>
              </div>

              {/* 이상 징후 감지 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    이상 징후 감지
                  </h3>
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-3xl font-bold text-yellow-600 mb-2">
                  {predictionData.anomalyDetection.probability}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {predictionData.anomalyDetection.potentialIssues.length}개 잠재 이슈 발견
                </div>
              </div>

              {/* 시스템 트렌드 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    시스템 트렌드
                  </h3>
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">성능</span>
                    <div className="flex items-center">
                      {getTrendIcon(predictionData.trends.performance)}
                      <span className="ml-1 text-sm font-medium">{predictionData.trends.performance}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">사용량</span>
                    <div className="flex items-center">
                      {getTrendIcon(predictionData.trends.usage)}
                      <span className="ml-1 text-sm font-medium">{predictionData.trends.usage}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">에러율</span>
                    <div className="flex items-center">
                      {getTrendIcon(predictionData.trends.errors)}
                      <span className="ml-1 text-sm font-medium">{predictionData.trends.errors}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 부하 예측 차트 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                24시간 부하 예측
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="load" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3} 
                      name="실제 부하"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3} 
                      name="예측 부하"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 잠재 이슈 목록 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                잠재적 이슈 및 권장사항
              </h3>
              <div className="space-y-4">
                {predictionData.anomalyDetection.potentialIssues.map((issue, index) => (
                  <div key={index} className="border-l-4 border-yellow-400 pl-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-r-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {issue.service}
                          </span>
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            {issue.probability}% 확률
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {issue.description}
                        </p>
                        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                          <Zap className="h-4 w-4 mr-1" />
                          권장사항: {issue.suggestedAction}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/service/${issue.service}`)}
                        className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        서비스 상세
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 권장사항 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                AI 권장사항
              </h3>
              <div className="space-y-3">
                {predictionData.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start">
                    <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default PredictiveAnalysisPage;