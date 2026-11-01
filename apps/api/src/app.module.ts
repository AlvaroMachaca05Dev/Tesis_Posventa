import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard, PermisosGuard } from './comun/guardias';
import { PrismaService } from './comun/prisma.service';
import { AuthController, SesionController } from './sistema/sesion/sesion.controller';
import { UsuariosController } from './sistema/usuario/usuario.controller';
import { ClienteController } from './maestros/cliente/cliente.controller';
import { VehiculoController } from './maestros/vehiculo/vehiculo.controller';
import { OrdenesController } from './posventa/ordenServicio/ordenServicio.controller';

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
  controllers: [AuthController, SesionController, UsuariosController, ClienteController, VehiculoController, OrdenesController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
