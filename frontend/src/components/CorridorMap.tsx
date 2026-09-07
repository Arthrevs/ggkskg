import { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StationNode, TrackEdge, MegaBlock } from '../api/client';

interface MapProps {
  nodes: StationNode[];
  edges: TrackEdge[];
  blocks: MegaBlock[];
}

export function CorridorMap({ nodes: trackNodes, edges: trackEdges, blocks }: MapProps) {
  const { nodes, edges } = useMemo(() => {
    // 1. Layout nodes using REAL Geographic Coordinates (Lat/Lng)
    const lats = trackNodes.map(n => n.lat);
    const lngs = trackNodes.map(n => n.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const mapWidth = 1200;
    const mapHeight = 400; 
    
    const rfNodes: Node[] = trackNodes.map(n => {
      // Scale coordinates to the React Flow viewport
      // Longitude maps to X (East/West). Latitude maps to Y (North/South, inverted for screen coords)
      const x = ((n.lng - minLng) / (maxLng - minLng)) * mapWidth;
      const y = mapHeight - (((n.lat - minLat) / (maxLat - minLat)) * mapHeight);

      return {
        id: n.id,
        position: { x, y: y + 100 }, // Add padding to Y
      data: { label: `${n.name}\n(KM ${n.km})` },
      type: 'default',
      style: {
        background: '#0f172a',
        color: '#ffffff',
        border: '2px solid #334155',
        borderRadius: '0px', // Brutalist
        width: 120,
        textAlign: 'center' as const,
        fontFamily: 'monospace',
        fontSize: '12px',
        fontWeight: 'bold',
      },
      sourcePosition: 'right' as any,
      targetPosition: 'left' as any,
      };
    });

    // 2. Build UP and DN edges
    const rfEdges: Edge[] = [];
    trackEdges.forEach(te => {
      if (te.line_type !== 'mainline') return;

      const isUp = te.direction === 'UP';
      
      // Determine if a block overlaps this edge
      const isBlocked = blocks.some(b => 
        b.affected_segments.some(seg => 
          (seg[0] === te.source && seg[1] === te.target) || 
          (seg[0] === te.target && seg[1] === te.source)
        )
      );

      rfEdges.push({
        id: te.id,
        source: te.source,
        target: te.target,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: isBlocked ? '#FFFF00' : '#00FF00', // Yellow if block, Green if clear
          strokeWidth: isBlocked ? 6 : 3,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isBlocked ? '#FFFF00' : '#00FF00',
        },
        label: isUp ? 'UP' : 'DN',
        labelStyle: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 10 },
        labelBgStyle: { fill: '#0f172a' },
      });
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [trackNodes, trackEdges, blocks]);

  return (
    <div className="w-full h-full bg-slate-950 border border-rail-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.5}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="bg-rail-panel border-rail-border" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
