import { Injectable ,ExecutionContext } from "@nestjs/common";
import { JwtService} from "@nestjs/jwt";
import { Role } from "@prisma/client";


@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async generateTokenPair(username: string, userId:string, role:Role) {
    const payload = {username , userId , role};
    const token = this.jwtService.sign(payload);
    
    return {
      access_token: token,
    };
  }

}