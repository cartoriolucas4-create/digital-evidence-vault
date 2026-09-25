-- Keep the performance notification type aligned with the application type.
alter table public.study_performance_notifications
  drop constraint if exists study_performance_notifications_notification_type_check;

alter table public.study_performance_notifications
  add constraint study_performance_notifications_notification_type_check
  check (notification_type in (
    'drop_severe','drop','attention','recovery','record','exceptional','evolution','stagnation'
  ));
