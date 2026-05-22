// Re-export from shared DTOs
export { LoginSchema, type LoginDTO } from '../../auth/dto/register.request';
// Legacy class kept for type compatibility
export class LoginRequest { email!: string; password!: string; }
