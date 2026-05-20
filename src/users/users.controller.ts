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
  createManager(@Body() createUserDto: CreateUserDto) {
    if(createUserDto.role === Role.SUPER_ADMIN){
    return this.usersService.createManager(createUserDto);
    }
    else{
    return this.usersService.creatEmploye(createUserDto);
    }
  }


 @Public()
 @Post("loginIn")
 loginIn(@Body() createUserDto: CreateUserDto) {
    return this.usersService.loginIn(createUserDto.passwordHash, createUserDto.email);
  }
 


  @Get('search_Word')
  search(@Query('search_Word') search_Word: string) {
    return this.usersService.search(search_Word);
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
