import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MachineType, Sensor, SensorModel } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { CreateSensorDto } from './dto/create-sensor.dto';

export const ALLOWED_SENSORS = {
  Pump: ['HFPlus'],
  Fan: Object.values(SensorModel),
};

@Injectable()
export class SensorService {
  constructor(private prisma: PrismaService) {}

  private isModelAllowed(sensorModel: SensorModel, machineType: MachineType) {
    return ALLOWED_SENSORS[machineType].includes(sensorModel);
  }

  async create(
    createSensorDto: CreateSensorDto,
    monitoringPointId: number,
    userId: number
  ): Promise<Sensor> {
    try {
      const { machine } = await this.prisma.monitoringPoint.findUniqueOrThrow({
        where: {
          id: monitoringPointId,
          userId,
        },
        include: {
          machine: true,
        },
      });
      const { model: sensorModel } = createSensorDto;
      const { type: machineType } = machine;

      if (!this.isModelAllowed(sensorModel, machineType)) {
        throw new BadRequestException(
          `This model: ${sensorModel} is incompatible with this monitoring point's machine: ${machineType}`
        );
      }

      return await this.prisma.sensor.upsert({
        where: {
          monitoringPointId,
        },
        update: {
          model: sensorModel,
        },
        create: {
          model: sensorModel,
          monitoringPoint: {
            connect: { id: monitoringPointId },
          },
        },
      });
    } catch (error) {
      if (error?.code === 'P2025') {
        throw new NotFoundException();
      }

      throw error;
    }
  }
}
