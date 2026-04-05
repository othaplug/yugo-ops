import { z } from "zod";

export const addressStopSchema = z.object({
  address: z.string(),
  access: z.string().optional(),
  label: z.string().optional(),
});

export const paymentMilestoneSchema = z.object({
  milestone: z.string(),
  amount: z.number(),
  due: z.string().optional(),
  paid: z.boolean().optional(),
});

export const officeProfileSchema = z
  .object({
    company_name: z.string().optional(),
    current_address: z.string().optional(),
    new_address: z.string().optional(),
    current_floors: z.number().int().optional(),
    new_floors: z.number().int().optional(),
    workstation_count: z.number().int().optional(),
    server_room: z.boolean().optional(),
    boardroom_count: z.number().int().optional(),
    break_room: z.boolean().optional(),
    reception: z.boolean().optional(),
    phasing_strategy: z
      .enum(["all_at_once", "floor_by_floor", "department_by_department", "custom"])
      .optional(),
  })
  .passthrough();

export const moveProjectDayInputSchema = z.object({
  id: z.string().uuid().optional(),
  day_number: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  crew_size: z.number().int().min(1).default(2),
  crew_ids: z.array(z.string().uuid()).optional().nullable(),
  truck_type: z.string().optional().nullable(),
  truck_count: z.number().int().min(1).default(1),
  estimated_hours: z.number().optional().nullable(),
  origin_address: z.string().optional().nullable(),
  destination_address: z.string().optional().nullable(),
  arrival_window: z.string().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  day_cost_estimate: z.number().optional().nullable(),
  status: z.string().optional(),
  completion_notes: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
  move_id: z.string().uuid().optional().nullable(),
});

export const moveProjectPhaseInputSchema = z.object({
  id: z.string().uuid().optional(),
  phase_number: z.number().int().min(1),
  phase_name: z.string().min(1),
  phase_type: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  origin_index: z.number().int().optional().nullable(),
  destination_index: z.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  sort_order: z.number().int().optional(),
  days: z.array(moveProjectDayInputSchema).default([]),
});

export const moveProjectPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  project_name: z.string().min(1),
  project_type: z.string().min(1).default("residential_standard"),
  office_profile: officeProfileSchema.optional(),
  multi_home_move_type: z
    .enum(["consolidation", "split", "multi_stop", "seasonal"])
    .optional()
    .nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  total_days: z.number().int().min(1).optional(),
  origins: z.array(addressStopSchema).default([]),
  destinations: z.array(addressStopSchema).default([]),
  total_price: z.number().optional().nullable(),
  deposit: z.number().optional().nullable(),
  payment_schedule: z.array(paymentMilestoneSchema).optional().default([]),
  status: z.string().optional(),
  coordinator_id: z.string().uuid().optional().nullable(),
  coordinator_name: z.string().optional().nullable(),
  special_instructions: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  phases: z.array(moveProjectPhaseInputSchema).default([]),
});

export type MoveProjectPayload = z.infer<typeof moveProjectPayloadSchema>;
export type MoveProjectPhaseInput = z.infer<typeof moveProjectPhaseInputSchema>;
export type MoveProjectDayInput = z.infer<typeof moveProjectDayInputSchema>;

export const completeDayBodySchema = z.object({
  completion_notes: z.string().optional().nullable(),
  status: z.enum(["completed", "cancelled", "rescheduled"]).default("completed"),
});
