export enum Option {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
}

export interface Element {
  type: "audio" | "image";
  url: string;
}

export interface QuestionType {
  id: number;
  group_id: number;
  option: Option[];
  correct_option: Option;
  title: string;
  description?: string;
  score: number;
  elements?: Element[];
  type_group?: number;
  order: number;
  global_order: number;
}

export interface GroupQuestionType {
  part_id: number;
  order: number;
  title?: string;
  description?: string;
  type_group?: number;
  elements: Element[];
  questions: QuestionType[];
  pathDir?: string;
}
