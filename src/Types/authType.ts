export interface LoginType {
  accessToken: string;
  refreshToken: string;
}

export interface AuthType {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  role: number;
  otp?: string;
  create_at: Date;
  update_at: Date;
}
