/**
 * Virtual List Component for Performance Optimization
 * 가상 스크롤링을 통한 성능 최적화 컴포넌트
 */

import React, { useCallback, useRef, useMemo } from 'react';
import { FixedSizeList, VariableSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { performanceLogger } from '../../lib/utils/logger';

// ============ Types ============

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  onScroll?: (scrollOffset: number, scrollDirection: 'forward' | 'backward') => void;
  className?: string;
  emptyMessage?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  estimatedItemSize?: number;
  threshold?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

// ============ Virtual List Component ============

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  onScroll,
  className = '',
  emptyMessage = 'No items to display',
  header,
  footer,
  estimatedItemSize = 50,
  threshold = 1000,
  onEndReached,
  endReachedThreshold = 0.8
}: VirtualListProps<T>) {
  const listRef = useRef<FixedSizeList | VariableSizeList>(null);
  const lastScrollDirection = useRef<'forward' | 'backward'>('forward');
  const lastScrollOffset = useRef(0);
  const hasCalledEndReached = useRef(false);

  // 아이템 높이가 고정인지 가변인지 확인
  const isFixedHeight = typeof itemHeight === 'number';

  // 아이템 렌더러
  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    if (index >= items.length) return null;
    
    return (
      <div style={style}>
        {renderItem(items[index], index, style)}
      </div>
    );
  }, [items, renderItem]);

  // 스크롤 핸들러
  const handleScroll = useCallback(({
    scrollDirection,
    scrollOffset,
    scrollUpdateWasRequested
  }: {
    scrollDirection: 'forward' | 'backward';
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => {
    lastScrollDirection.current = scrollDirection;
    lastScrollOffset.current = scrollOffset;
    
    onScroll?.(scrollOffset, scrollDirection);

    // End reached detection
    if (onEndReached && !scrollUpdateWasRequested) {
      const list = listRef.current;
      if (!list) return;

      const totalHeight = isFixedHeight
        ? items.length * itemHeight
        : typeof (list as VariableSizeList).props.itemSize === 'function'
          ? items.reduce((sum, _, index) => sum + ((list as VariableSizeList).props.itemSize as Function)(index), 0)
          : items.length * estimatedItemSize;

      const viewportHeight = (list as any)._outerRef?.clientHeight || 0;
      const scrollPercentage = (scrollOffset + viewportHeight) / totalHeight;

      if (scrollPercentage >= endReachedThreshold && !hasCalledEndReached.current) {
        hasCalledEndReached.current = true;
        performanceLogger.measure('virtual-list-end-reached', async () => {
          await onEndReached();
          hasCalledEndReached.current = false;
        });
      }
    }
  }, [onScroll, onEndReached, items.length, itemHeight, isFixedHeight, estimatedItemSize, endReachedThreshold]);

  // 아이템 키 생성
  const itemKey = useCallback((index: number) => {
    const item = items[index];
    return (item as any).id || (item as any).key || index;
  }, [items]);

  // 리스트 컴포넌트 렌더링
  const renderList = useCallback(({ height, width }: { height: number; width: number }) => {
    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          {emptyMessage}
        </div>
      );
    }

    // 성능 최적화: 많은 아이템의 경우 가상화 사용
    if (items.length > threshold) {
      if (isFixedHeight) {
        return (
          <FixedSizeList
            ref={listRef as React.RefObject<FixedSizeList>}
            height={height}
            width={width}
            itemCount={items.length}
            itemSize={itemHeight as number}
            overscanCount={overscan}
            onScroll={handleScroll}
            itemKey={itemKey}
          >
            {Row}
          </FixedSizeList>
        );
      } else {
        return (
          <VariableSizeList
            ref={listRef as React.RefObject<VariableSizeList>}
            height={height}
            width={width}
            itemCount={items.length}
            itemSize={itemHeight as (index: number) => number}
            estimatedItemSize={estimatedItemSize}
            overscanCount={overscan}
            onScroll={handleScroll}
            itemKey={itemKey}
          >
            {Row}
          </VariableSizeList>
        );
      }
    }

    // 적은 아이템의 경우 일반 렌더링
    return (
      <div className="h-full overflow-y-auto" onScroll={(e) => {
        const target = e.currentTarget;
        const scrollOffset = target.scrollTop;
        const scrollDirection = scrollOffset > lastScrollOffset.current ? 'forward' : 'backward';
        handleScroll({ scrollDirection, scrollOffset, scrollUpdateWasRequested: false });
      }}>
        {items.map((item, index) => (
          <div key={itemKey(index)}>
            {renderItem(item, index, {})}
          </div>
        ))}
      </div>
    );
  }, [items, threshold, isFixedHeight, itemHeight, overscan, handleScroll, itemKey, Row, emptyMessage, renderItem, estimatedItemSize]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {header && <div className="flex-shrink-0">{header}</div>}
      
      <div className="flex-1 min-h-0">
        <AutoSizer>
          {renderList}
        </AutoSizer>
      </div>
      
      {footer && <div className="flex-shrink-0">{footer}</div>}
    </div>
  );
}

// ============ Virtual Grid Component ============

export interface VirtualGridProps<T> {
  items: T[];
  columnCount: number;
  rowHeight: number | ((index: number) => number);
  columnWidth: number | ((index: number) => number);
  renderCell: (item: T, rowIndex: number, columnIndex: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  className?: string;
  gap?: number;
}

export function VirtualGrid<T>({
  items,
  columnCount,
  rowHeight,
  columnWidth,
  renderCell,
  overscan = 2,
  className = '',
  gap = 0
}: VirtualGridProps<T>) {
  const rowCount = Math.ceil(items.length / columnCount);

  const Cell = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const itemIndex = rowIndex * columnCount + columnIndex;
    if (itemIndex >= items.length) return null;

    const adjustedStyle = gap ? {
      ...style,
      left: style.left + gap * columnIndex,
      top: style.top + gap * rowIndex,
      width: style.width - gap,
      height: style.height - gap
    } : style;

    return (
      <div style={adjustedStyle}>
        {renderCell(items[itemIndex], rowIndex, columnIndex, adjustedStyle)}
      </div>
    );
  }, [items, columnCount, renderCell, gap]);

  return (
    <div className={className}>
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => {
          const FixedSizeGrid = require('react-window').FixedSizeGrid;
          const VariableSizeGrid = require('react-window').VariableSizeGrid;

          const isFixedRowHeight = typeof rowHeight === 'number';
          const isFixedColumnWidth = typeof columnWidth === 'number';

          if (isFixedRowHeight && isFixedColumnWidth) {
            return (
              <FixedSizeGrid
                height={height}
                width={width}
                rowCount={rowCount}
                columnCount={columnCount}
                rowHeight={rowHeight + gap}
                columnWidth={columnWidth + gap}
                overscanRowCount={overscan}
                overscanColumnCount={overscan}
              >
                {Cell}
              </FixedSizeGrid>
            );
          } else {
            return (
              <VariableSizeGrid
                height={height}
                width={width}
                rowCount={rowCount}
                columnCount={columnCount}
                rowHeight={isFixedRowHeight ? () => rowHeight + gap : (index: number) => (rowHeight as Function)(index) + gap}
                columnWidth={isFixedColumnWidth ? () => columnWidth + gap : (index: number) => (columnWidth as Function)(index) + gap}
                overscanRowCount={overscan}
                overscanColumnCount={overscan}
              >
                {Cell}
              </VariableSizeGrid>
            );
          }
        }}
      </AutoSizer>
    </div>
  );
}

// ============ Optimized Service List Example ============

import { MCPService } from '../../types';

export interface OptimizedServiceListProps {
  services: MCPService[];
  onServiceClick?: (service: MCPService) => void;
  selectedServiceId?: string | null;
}

export const OptimizedServiceList: React.FC<OptimizedServiceListProps> = ({
  services,
  onServiceClick,
  selectedServiceId
}) => {
  const renderService = useCallback((service: MCPService, index: number, style: React.CSSProperties) => {
    const isSelected = service.id === selectedServiceId;
    
    return (
      <div
        style={style}
        className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={() => onServiceClick?.(service)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{service.name}</h3>
            <p className="text-sm text-gray-500">{service.description}</p>
          </div>
          <div className={`px-2 py-1 text-xs rounded-full ${
            service.status === 'healthy' ? 'bg-green-100 text-green-800' :
            service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {service.status}
          </div>
        </div>
      </div>
    );
  }, [onServiceClick, selectedServiceId]);

  return (
    <VirtualList
      items={services}
      itemHeight={80}
      renderItem={renderService}
      className="border border-gray-200 rounded-lg"
      emptyMessage="No services available"
    />
  );
};

// ============ Performance Monitoring Hook ============

export function useVirtualListPerformance(listName: string) {
  const metrics = useRef({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0
  });

  const measureRender = useCallback(() => {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      metrics.current.renderCount++;
      metrics.current.lastRenderTime = duration;
      metrics.current.averageRenderTime = 
        (metrics.current.averageRenderTime * (metrics.current.renderCount - 1) + duration) / 
        metrics.current.renderCount;

      if (metrics.current.renderCount % 100 === 0) {
        console.debug(`Virtual list performance: ${listName}`, {
          renderCount: metrics.current.renderCount,
          lastRenderTime: metrics.current.lastRenderTime.toFixed(2),
          averageRenderTime: metrics.current.averageRenderTime.toFixed(2)
        });
      }
    };
  }, [listName]);

  const getMetrics = useCallback(() => ({ ...metrics.current }), []);

  return { measureRender, getMetrics };
}