"use client";

import {
  Background,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ParentChild, Partnership, Person } from "@/db/schema";
import { lifespanLabel } from "@/lib/fuzzy-date";
import {
  layoutFamily,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  UNION_SIZE,
} from "@/lib/layout";

type PersonNodeData = { person: Person; selected: boolean };
type PersonNodeType = Node<PersonNodeData, "person">;
type UnionNodeType = Node<Record<string, never>, "union">;

const GENDER_STYLES: Record<Person["gender"], string> = {
  male: "border-sky-400 bg-sky-50 dark:border-sky-600 dark:bg-sky-950",
  female: "border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950",
  other:
    "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950",
  unknown: "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900",
};

/** 線をつなぐ点。家系図では線を引き直させないので見せない */
const hiddenHandle = "!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent";

function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person, selected } = data;
  const lifespan = lifespanLabel(person.birthDate, person.deathDate);
  return (
    <div
      style={{ width: PERSON_WIDTH, height: PERSON_HEIGHT }}
      className={`flex flex-col justify-center rounded-lg border-2 px-3 text-left shadow-sm ${GENDER_STYLES[person.gender]} ${
        selected ? "ring-4 ring-amber-400" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className={hiddenHandle} />
      <p className="truncate text-sm font-bold">
        {person.name}
        {person.deathDate && <span className="ml-1 text-zinc-400">†</span>}
      </p>
      {person.kana && (
        <p className="truncate text-[10px] text-zinc-500">{person.kana}</p>
      )}
      {lifespan && (
        <p className="text-xs tabular-nums text-zinc-500">{lifespan}</p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className={hiddenHandle}
      />
    </div>
  );
}

/** 夫婦の間の点。2 人の線がここで合流し、子へ下りる */
function UnionNode() {
  return (
    <div className="h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500">
      <Handle type="target" position={Position.Top} className={hiddenHandle} />
      <Handle
        type="source"
        position={Position.Bottom}
        className={hiddenHandle}
      />
    </div>
  );
}

const nodeTypes = { person: PersonNode, union: UnionNode };

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * OS のダークモード設定。React Flow の colorMode="system" は SSR で light と決めたまま
 * ハイドレーション後に切り替わらないため、自前で読んで渡す
 */
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(DARK_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1.2, duration: 300 };

type FamilyGraphProps = {
  persons: Person[];
  parents: ParentChild[];
  partners: Partnership[];
  selectedId: number | null;
  onSelect: (personId: number | null) => void;
};

export function FamilyGraph(props: FamilyGraphProps) {
  // fitView を外から呼ぶため、useReactFlow が使えるよう Provider で包む
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}

function Graph({
  persons,
  parents,
  partners,
  selectedId,
  onSelect,
}: FamilyGraphProps) {
  // レイアウトは人物とつながりが変わったときだけ計算し直す（選択の切り替えでは動かさない）
  const layout = useMemo(
    () => layoutFamily(persons, parents, partners),
    [persons, parents, partners],
  );
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const computedNodes = useMemo(
    (): (PersonNodeType | UnionNodeType)[] =>
      layout.nodes.flatMap((n): (PersonNodeType | UnionNodeType)[] => {
        if (n.kind === "union") {
          return [
            {
              id: n.id,
              type: "union",
              position: { x: n.x, y: n.y },
              data: {},
              selectable: false,
              width: UNION_SIZE,
              height: UNION_SIZE,
            },
          ];
        }
        const person = byId.get(n.personId);
        if (!person) return [];
        return [
          {
            id: n.id,
            type: "person",
            position: { x: n.x, y: n.y },
            // SSR でも大きさが分かるように渡しておく
            width: PERSON_WIDTH,
            height: PERSON_HEIGHT,
            data: { person, selected: person.id === selectedId },
          },
        ];
      }),
    [layout, byId, selectedId],
  );

  // nodes を毎回作り直して直接渡すと、React Flow が測ったノードの大きさ（線の端点の計算に要る）が
  // 捨てられ、更新のあとに一部の線が描かれなくなる。onNodesChange で測った結果を受け取れるよう state に持つ
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);

  // 人やつながりが増減したときだけ、全体が収まるように表示し直す。名前やメモを直しただけでも
  // 配列は作り直されるので、layout ではなくノードと線の ID の並びで変化を見る
  const { fitView } = useReactFlow();
  const prefersDark = usePrefersDark();
  const structure = useMemo(
    () =>
      [...layout.nodes.map((n) => n.id), ...layout.edges.map((e) => e.id)]
        .sort()
        .join(","),
    [layout],
  );
  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    return () => cancelAnimationFrame(id);
  }, [structure, fitView]);

  const edges = useMemo(
    (): Edge[] =>
      layout.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style:
          e.kind === "partner"
            ? { stroke: "#f59e0b", strokeWidth: 2 }
            : { stroke: "#a1a1aa", strokeWidth: 1.5 },
      })),
    [layout],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      colorMode={prefersDark ? "dark" : "light"}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      onNodeClick={(_, node) => {
        if (node.type === "person") onSelect(Number(node.id.slice(1)));
      }}
      onPaneClick={() => onSelect(null)}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
