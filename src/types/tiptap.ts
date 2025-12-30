export interface TipTapMark {
    type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link';
    attrs?: Record<string, unknown>;
}

export interface TipTapNode {
    type: string;
    text?: string;
    marks?: TipTapMark[];
    attrs?: Record<string, unknown>;
    content?: TipTapNode[];
}

export interface TipTapDoc extends TipTapNode {
    type: 'doc';
    content: TipTapNode[];
}
