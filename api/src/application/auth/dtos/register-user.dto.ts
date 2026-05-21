export interface RegisterUserDTO {
  email: string;
  password: string;
  name: string;
  role?: string;
  institutionId?: string;
}
