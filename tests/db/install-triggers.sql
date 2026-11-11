\set ON_ERROR_STOP on
create trigger appointments_respect_calendar_blocks
before insert or update of starts_at,ends_at,status on public.appointments
for each row execute function public.calendar_blocks_reservation_guard();

create trigger calendar_blocks_respect_existing_appointments
before insert or update of start_at,end_at on public.calendar_blocks
for each row execute function public.calendar_blocks_appointment_guard();

create trigger tr_credit_points_after_completion
after insert or update of status on public.appointments
for each row execute function public.credit_points_after_completion();

create trigger tr_refund_cancelled_points_booking
after update of status on public.appointments
for each row execute function public.refund_cancelled_points_booking();

create trigger tr_protect_cancelled_points_booking
before update of status on public.appointments
for each row execute function public.protect_cancelled_points_booking();
