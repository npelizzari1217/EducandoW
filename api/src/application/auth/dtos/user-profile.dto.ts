export interface UserProfileDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  institutionId?: string;
  level?: string;
  createdAt: string;
}
