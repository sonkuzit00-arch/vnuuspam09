import { z } from "zod";
import {
  SOURCE_CHANNELS,
  DISTRICTS,
  CATEGORIES,
  RESOLUTION_PATHS,
  TARGET_AUDIENCES,
  STAGES,
} from "@/lib/constants";

export const createAppealSchema = z.object({
  sourceChannel: z.enum(SOURCE_CHANNELS),
  subject: z.string().optional(),
  lastName: z.string().min(1, "Укажите фамилию заявителя"),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  socialHandle: z.string().optional(),
  address: z.string().optional(),
  district: z.enum(DISTRICTS).optional(),
  isCollective: z.coerce.boolean().optional(),
  signatoryCount: z.coerce.number().int().positive().optional(),
  goal: z.string().min(1, "Опишите цель обращения"),
  description: z.string().optional(),
  category: z.enum(CATEGORIES),
  targetAudience: z.enum(TARGET_AUDIENCES).optional(),
  responsibleId: z.string().min(1, "Выберите ответственного"),
  controlDate: z.string().optional(),
});

export type CreateAppealInput = z.infer<typeof createAppealSchema>;

export const updateAppealSchema = z.object({
  id: z.string(),
  concept: z.string().optional(),
  actionPlan: z.string().optional(),
  resolutionPath: z.enum(RESOLUTION_PATHS).optional(),
  result: z.string().optional(),
  controlDate: z.string().optional(),
  stage: z.enum(STAGES).optional(),
});
