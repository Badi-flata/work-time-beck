import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Public } from 'src/core/decorators/Public.decorator';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
@Auth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('logUp') 
  createManager(@Body() body: any) {
    if (!body.fullName) {
      body.fullName = [body.firstName, body.lastName].filter(Boolean).join(' ') || 'User';
    }
    if (!body.passwordHash) {
      body.passwordHash = body.password;
    }
    const createUserDto = body as CreateUserDto;
    if(createUserDto.role === Role.SUPER_ADMIN){
      return this.usersService.createManager(createUserDto);
    }
    else{
      return this.usersService.creatEmploye(createUserDto);
    }
  }


 @Public()
 @Post("loginIn")
 loginIn(@Body() body: any) {
    const password = body.passwordHash || body.password;
    return this.usersService.loginIn(password, body.email);
  }
 


  @Get('search_Word')
  search(
    @Query('search_Word') search_Word: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('includeDiscipline') includeDiscipline?: string,
  ) {
    return this.usersService.search(
      search_Word,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      role,
      includeDiscipline === 'true',
    );
  }


  @Patch('updateMyProfile')
  update(@CurrentUser('userId') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete('deleteMyProfile')
  remove(@CurrentUser('userId') id: string) {
    return this.usersService.remove(id);
  }
}
