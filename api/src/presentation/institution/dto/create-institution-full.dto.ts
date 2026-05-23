import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const IMAGE_URL_REGEX = /\.(png|jpg|jpeg|svg)(\?.*)?$/i;

const nameField = z.string().min(1).max(200);
const optionalShortString = z.string().max(300).optional();
const optionalMediumString = z.string().max(500).optional();
const optionalUrl = z.string().url('Debe ser una URL válida').optional();
const hexColorField = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Debe ser un color hexadecimal válido (ej. #1a56db)')
  .optional();
const smtpEncryptionField = z.enum(['TLS', 'SSL', 'NONE']).optional();
const portField = z.number().int().min(1).max(65535).optional();

export const CreateInstitutionFullSchema = z.object({
  // Identificación
  name: z.string().min(1).max(200),
  cue: z
    .string()
    .regex(/^[A-Za-z0-9]+$/, 'El CUE debe ser alfanumérico')
    .optional(),
  ministry_reg: z.string().max(100).optional(),

  // Contacto
  address: optionalShortString,
  city: optionalShortString,
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).optional().default('AR'),
  phone: z.string().max(50).optional(),
  website: optionalUrl,
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),

  // Branding
  logo_url: z
    .union([
      z.string().url('Debe ser una URL válida').regex(IMAGE_URL_REGEX, 'El logo debe ser PNG, JPG, JPEG o SVG'),
      z.string().regex(/^\/[^\s]*$/, 'La ruta relativa debe comenzar con /'),
    ])
    .optional(),
  header_color: hexColorField,
  header_text_color: hexColorField,
  body_text_color: hexColorField,

  // SMTP
  smtp_host: optionalMediumString,
  smtp_user: optionalMediumString,
  smtp_pass: optionalMediumString,
  smtp_encryption: smtpEncryptionField,
  smtp_port: portField,

  // Notificaciones
  send_email: z.boolean().optional().default(false),
  send_messages: z.boolean().optional().default(false),

  // Socket
  socket_host: optionalMediumString,
  socket_port: portField,

  // Niveles
  levels: z
    .array(z.enum([
      'INICIAL', 'TALLERES_INICIAL', 'BILINGÜISMO_INICIAL',
      'PRIMARIO', 'TALLERES_PRIMARIO', 'BILINGÜISMO_PRIMARIO',
      'SECUNDARIO', 'TALLERES_SECUNDARIO', 'BILINGÜISMO_SECUNDARIO',
      'TERCIARIO',
      'ADMINISTRACION', 'TODOS',
    ]))
    .min(1, 'Al menos un nivel requerido'),
});

export type CreateInstitutionFullDTO = z.infer<typeof CreateInstitutionFullSchema>;
