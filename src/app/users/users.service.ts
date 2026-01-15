import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Users } from './entities/user.entity';
import { JwtTokenService } from '@app/auth/services/jwt-token.service';
import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    private readonly jwtService: JwtTokenService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = this.userRepo.create(createUserDto);
    const savedUser = await this.userRepo.save(user);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
    };

    const Tokens = this.jwtService.generateTokenPair(payload);

    return {
      user: savedUser,
      ...Tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
    };

    return this.jwtService.generateTokenPair(payload);
  }

  async findAll() {
    return this.userRepo.find();
  }

  async findOne(id: string) {
    return this.userRepo.findOne({
      where: { id },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.userRepo.update(id, updateUserDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.userRepo.softDelete(id);
  }
}
