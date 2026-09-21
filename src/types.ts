export type Discipline = { id:string; name:string; created_at?:string; };
export type Subject = { id:string; discipline_id:string; name:string; created_at?:string; };
export type Source = { id:string; name:string; created_at?:string; };
export type QuestionType = { id:string; name:string; created_at?:string; };
export type Entry = {
  id:string; study_date:string; discipline_id:string|null; subject_id:string|null;
  source_id:string|null; question_type_id:string|null; questions:number; correct:number;
  notes:string|null; discipline_name_snapshot?:string|null; subject_name_snapshot?:string|null; source_name_snapshot?:string|null; question_type_name_snapshot?:string|null; created_at?:string; updated_at?:string;
  discipline?:{name:string}; subject?:{name:string}; source?:{name:string}; question_type?:{name:string};
};
export type Filters = { disciplineId:string; subjectId:string; sourceId:string; from:string; to:string; };
export type PerformanceNotification = {
  id:string; user_id:string; subject_id:string|null; subject_name:string; discipline_name:string|null;
  notification_type:"drop_severe"|"drop"|"attention"|"recovery"|"record"|"exceptional"|"evolution"|"stagnation";
  title:string; message:string; created_at:string; read_at:string|null;
};
