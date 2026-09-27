export type PostStatus = "captured" | "enriching" | "ready" | "error";

export type PipelineStep =
  | "queued"
  | "fetching"
  | "baseline"
  | "transcribing"
  | "reading"
  | "structuring"
  | "done";

export interface Post {
  id: number;
  shortcode: string;
  url: string;
  authorHandle: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  mediaType: "video" | "image" | "carousel" | null;
  /** "views" for videos, "likes" for images/carousels */
  metric: "views" | "likes" | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  medianMetric: number | null;
  baselineSize: number | null;
  outlierScore: number | null;
  caption: string | null;
  visualHook: string | null;
  spokenHook: string | null;
  transcript: string | null;
  hasSpeech: boolean | null;
  body: string | null;
  coreIdea: string | null;
  thumbnailPath: string | null;
  videoPath: string | null;
  durationSec: number | null;
  postedAt: string | null;
  status: PostStatus;
  step: PipelineStep;
  errorMsg: string | null;
  saved: boolean;
  source: "extension" | "manual" | "demo";
  capturedAt: string;
}

export interface Generation {
  id: number;
  postIds: number[];
  preset: string;
  prompt: string;
  output: string;
  model: string;
  createdAt: string;
}

/** A hook the user picked to send to MarioBot. */
export interface HookPick {
  postId: number;
  kind: "visual" | "spoken" | "caption";
  text: string;
}
