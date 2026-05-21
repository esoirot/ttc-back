import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyReply } from 'fastify';
import { InvoicesService } from './invoices.service';

type RequestWithUser = { user: { id: number } };

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id/pdf')
  @UseGuards(AuthGuard('jwt'))
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: FastifyReply,
  ) {
    const pdf = await this.invoicesService.generatePdf(id, req.user.id);
    void res.header('Content-Type', 'application/pdf');
    void res.header(
      'Content-Disposition',
      `attachment; filename="invoice-${id}.pdf"`,
    );
    return res.send(Buffer.from(pdf));
  }
}
