import React from 'react';
import { BaseEdge, getBezierPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.25,
  });

  const confidence = data?.confidence as string | undefined;
  const dashArray = confidence === 'low' ? '6 4' : confidence === 'medium' ? '4 2' : undefined;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        strokeDasharray: dashArray,
        transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
      }}
    />
  );
};

export default CustomEdge;
