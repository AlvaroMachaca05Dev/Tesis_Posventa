import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, SesionController } from './controladores';
import { UsuariosController } from './usuarios.controller';
import { AutenticacionGuard, PermisosGuard } from './guardias';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('Falta JWT_SECRET en el entorno (ver .env.example).');
        return { secret, signOptions: { expiresIn: '8h' } };
      },
    }),
  ],
  controllers: [AuthController, SesionController, UsuariosController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
