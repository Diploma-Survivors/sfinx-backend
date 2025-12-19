import { Module } from '@nestjs/common';
import { Judge0HttpClient } from './judge0-http.client';
import { Judge0Service } from './judge0.service';

@Module({
  providers: [Judge0HttpClient, Judge0Service],
  exports: [Judge0Service],
})
export class Judge0Module {}
