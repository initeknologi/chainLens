import { Body, Controller, Delete, Get, Headers, HttpException, HttpStatus, Param, Post, Put, Query } from '@nestjs/common'
import { z } from 'zod'
import { IntelligenceService } from './intelligence.service'
import { openApiDocument } from './openapi'
import { allowRequest } from './rate-limit'

const addressBody = z.object({
  address: z.string().min(1).max(120),
  chainIds: z.array(z.number().int()).max(4).optional(),
  save: z.boolean().optional(),
})
const explainBody = z.object({
  question: z.string().min(1).max(500),
  chainId: z.number().int(),
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  address: z.string().min(1).max(120).optional(),
})
const askBody = z.object({
  question: z.string().min(1).max(500),
  chainId: z.number().int().optional(),
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  address: z.string().min(1).max(120).optional(),
})
const accountBody = z.object({ displayName: z.string().min(1).max(80) })
const preferencesBody = z.object({
  networks: z.array(z.number().int()).max(4),
  showUnpriced: z.boolean(),
})

function chainIdsFrom(value?: string): number[] | undefined {
  if (!value) return undefined
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id))
  return ids.length > 0 ? ids : undefined
}

@Controller('api/v1')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('health')
  health() {
    return this.intelligence.health()
  }

  @Get('openapi.json')
  openapi() {
    return openApiDocument
  }

  @Get('networks')
  networks() {
    return this.intelligence.networks()
  }

  @Post('wallets/analyze')
  analyze(@Body() body: unknown, @Headers('authorization') authorization?: string, @Headers('x-forwarded-for') forwarded?: string) {
    this.guard(`analyze:${forwarded ?? 'local'}`, 8, 'RATE_LIMIT_EXCEEDED')
    const parsed = addressBody.safeParse(body)
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_WALLET_ADDRESS', message: 'Address is required.', error: 'Address is required.' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.intelligence.analyze(parsed.data.address, {
      chainIds: parsed.data.chainIds,
      save: parsed.data.save,
      authorization,
    })
  }

  @Get('wallets/:address')
  overview(@Param('address') address: string) {
    return this.intelligence.overview(address)
  }

  @Get('wallets/:address/balances')
  balances(@Param('address') address: string) {
    return this.intelligence.balances(address)
  }

  @Get('wallets/:address/portfolio')
  portfolio(@Param('address') address: string) {
    return this.intelligence.portfolio(address)
  }

  @Get('wallets/:address/activity')
  activity(@Param('address') address: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.intelligence.activity(address, Number(page ?? 1), Number(pageSize ?? 20))
  }

  @Get('wallets/:address/approvals')
  approvals(@Param('address') address: string) {
    return this.intelligence.approvals(address)
  }

  @Get('wallets/:address/analytics')
  analytics(@Param('address') address: string) {
    return this.intelligence.analytics(address)
  }

  @Get('analytics/:address/summary')
  summary(@Param('address') address: string) {
    return this.intelligence.analyticsSummary(address)
  }

  @Get('analytics/:address/history')
  history(@Param('address') address: string, @Query('chains') chains?: string) {
    return this.intelligence.analyticsHistory(address, chainIdsFrom(chains))
  }

  @Get('analytics/:address/allocation')
  allocation(@Param('address') address: string) {
    return this.intelligence.analyticsAllocation(address)
  }

  @Get('transactions/:chainId/:hash')
  transaction(@Param('chainId') chainId: string, @Param('hash') hash: string, @Query('address') address?: string) {
    return this.intelligence.transaction(Number(chainId), hash, address)
  }

  @Get('transactions/:chainId/:hash/decode')
  decode(@Param('chainId') chainId: string, @Param('hash') hash: string, @Query('address') address?: string) {
    return this.intelligence.decode(Number(chainId), hash, address)
  }

  @Get('transactions/:chainId/:hash/explain')
  explainGet(
    @Param('chainId') chainId: string,
    @Param('hash') hash: string,
    @Query('question') question = 'What happened in this transaction?',
    @Query('address') address?: string,
  ) {
    return this.intelligence.explain({ question, chainId: Number(chainId), hash, address })
  }

  @Get('contracts/:chainId/:address')
  contract(@Param('chainId') chainId: string, @Param('address') address: string) {
    return this.intelligence.contract(Number(chainId), address)
  }

  @Get('contracts/:chainId/:address/risks')
  risks(@Param('chainId') chainId: string, @Param('address') address: string) {
    return this.intelligence.contractRisks(Number(chainId), address)
  }

  @Get('contracts/:chainId/:address/abi')
  abi(@Param('chainId') chainId: string, @Param('address') address: string) {
    return this.intelligence.contractAbi(Number(chainId), address)
  }

  @Post('intelligence/explain')
  explain(@Body() body: unknown, @Headers('x-forwarded-for') forwarded?: string) {
    this.guard(`explain:${forwarded ?? 'local'}`, 20, 'RATE_LIMIT_EXCEEDED')
    const parsed = explainBody.safeParse(body)
    if (!parsed.success) {
      throw new HttpException(
        { code: 'ANALYSIS_INCOMPLETE', message: 'Question, chain id, and transaction hash are required.', error: 'Question, chain id, and transaction hash are required.' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.intelligence.explain(parsed.data)
  }

  @Post('explainer/explain')
  aiExplain(@Body() body: unknown, @Headers('x-forwarded-for') forwarded?: string) {
    return this.explain(body, forwarded)
  }

  @Post('explainer/ask')
  ask(@Body() body: unknown, @Headers('x-forwarded-for') forwarded?: string) {
    this.guard(`ask:${forwarded ?? 'local'}`, 20, 'RATE_LIMIT_EXCEEDED')
    const parsed = askBody.safeParse(body)
    if (!parsed.success) {
      throw new HttpException(
        { code: 'ANALYSIS_INCOMPLETE', message: 'A question is required.', error: 'A question is required.' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.intelligence.ask(parsed.data)
  }

  @Post('account')
  createAccount(@Body() body: unknown) {
    const parsed = accountBody.safeParse(body)
    if (!parsed.success) {
      throw new HttpException(
        { code: 'ANALYSIS_INCOMPLETE', message: 'A display name is required.', error: 'A display name is required.' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.intelligence.openAccount(parsed.data.displayName)
  }

  @Get('account')
  account(@Headers('authorization') authorization?: string) {
    return this.intelligence.account(authorization)
  }

  @Put('account/preferences')
  preferences(@Body() body: unknown, @Headers('authorization') authorization?: string) {
    const parsed = preferencesBody.safeParse(body)
    if (!parsed.success) {
      throw new HttpException(
        { code: 'ANALYSIS_INCOMPLETE', message: 'Preferences need networks and showUnpriced.', error: 'Preferences need networks and showUnpriced.' },
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.intelligence.savePreferences(authorization, parsed.data)
  }

  @Delete('account/wallets/:address')
  forget(@Param('address') address: string, @Headers('authorization') authorization?: string) {
    return this.intelligence.removeWallet(authorization, address)
  }

  @Delete('account')
  remove(@Headers('authorization') authorization?: string) {
    return this.intelligence.removeAccount(authorization)
  }

  private guard(key: string, limit: number, code: string) {
    if (!allowRequest(key, limit, 60_000)) {
      throw new HttpException(
        { code, message: 'Too many requests. Wait a minute and try again.', error: 'Too many requests. Wait a minute and try again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }
}
