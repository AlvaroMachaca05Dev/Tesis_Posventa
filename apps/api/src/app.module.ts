import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { cabecerasSeguridad } from './comun/seguridad';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard, PermisosGuard } from './comun/guardias';
import { PrismaService } from './comun/prisma.service';
import { AuthController, SesionController } from './sesion/sesion.controller';
import { UsuariosController } from './usuario/usuario.controller';
import { ClienteController } from './cliente/cliente.controller';
import { ConsultaDocumentoController } from './cliente/consultaDocumento';
import { VehiculoController } from './vehiculo/vehiculo.controller';
import { ConsultaVehicularController } from './vehiculo/consultaVehicular';
import { OrdenesController } from './ordenServicio/ordenServicio.controller';
import { MaestrosController } from './maestros/maestros.controller';
import { EmpresaController } from './empresa/empresa.controller';

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
  controllers: [AuthController, SesionController, UsuariosController, ClienteController, ConsultaDocumentoController, VehiculoController, ConsultaVehicularController, OrdenesController, MaestrosController, EmpresaController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: AutenticacionGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cabecerasSeguridad).forRoutes('*');
  }
}
