import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const IMAGE_URL_REGEX = /\.(png|jpg|jpeg|svg)(\?.*)?$/i;

const optionalShortString = z.string().max(300).optional();
const optionalMediumString = z.string().max(500).optional();
const optionalUrl = z.string().url('Debe ser una URL válida').optional();
const hexColorField = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Debe ser un color hexadecimal válido (ej. #1a56db)')
  .optional();
const smtpEncryptionField = z.enum(['TLS', 'SSL', 'NONE']).optional();
const portField = z.number().int().min(1).max(65535).optional();

const levelNameEnum = z.enum([
  'INICIAL', 'TALLERES_INICIAL', 'BILINGÜISMO_INICIAL',
  'PRIMARIO', 'TALLERES_PRIMARIO', 'BILINGÜISMO_PRIMARIO',
  'SECUNDARIO', 'TALLERES_SECUNDARIO', 'BILINGÜISMO_SECUNDARIO',
  'TERCIARIO',
  'ADMINISTRACION', 'TODOS',
]);

const institutionLevelSchema = z.object({
  level: z.string().min(1),
  modality: z.string().optional().default('COMUN'),
});

const InstitutionFullBaseSchema = z.object({
  name: z.string().min(1).max(200),
  cue: z.string().regex(/^[A-Za-z0-9]+$/, 'El CUE debe ser alfanumérico').optional(),
  ministry_reg: z.string().max(100).optional(),
  address: optionalShortString,
  city: optionalShortString,
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).optional().default('AR'),
  phone: z.string().max(50).optional(),
  website: optionalUrl,
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  logo_url: z
    .union([
      z.string().url('Debe ser una URL válida').regex(IMAGE_URL_REGEX, 'El logo debe ser PNG, JPG, JPEG o SVG'),
      z.string().regex(/^\/[^\s]*$/, 'La ruta relativa debe comenzar con /'),
    ])
    .optional(),
  header_color: hexColorField,
  header_text_color: hexColorField,
  body_text_color: hexColorField,
  smtp_host: optionalMediumString,
  smtp_user: optionalMediumString,
  smtp_pass: optionalMediumString,
  smtp_encryption: smtpEncryptionField,
  smtp_port: portField,
  send_email: z.boolean().optional().default(false),
  send_messages: z.boolean().optional().default(false),
  socket_host: optionalMediumString,
  socket_port: portField,
  institution_levels: z.array(institutionLevelSchema).optional(),
  levels: z.array(levelNameEnum).optional(),
});

/** Create schema — requires at least one level via institution_levels or levels */
export const CreateInstitutionFullSchema = InstitutionFullBaseSchema.refine(
  (data) => !!(data.institution_levels?.length || data.levels?.length),
  { message: 'Debe especificar al menos un nivel educativo (institution_levels o levels)', path: ['institution_levels'] },
);

export type CreateInstitutionFullDTO = z.infer<typeof CreateInstitutionFullSchema>;

/** Update schema — all fields optional */
export const UpdateInstitutionSchema = InstitutionFullBaseSchema.partial();
export type UpdateInstitutionDTO = z.infer<typeof UpdateInstitutionSchema>;
