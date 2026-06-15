import { IsEmail, IsString, MinLength } from 'class-validator'

// Shape + validation rules for the login request body.
// The global ValidationPipe enforces these before the controller runs.
export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  password!: string
}
