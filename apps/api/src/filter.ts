import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { InvalidAddressError, NotFoundError, SecretMaterialError, UnsupportedChainError, UpstreamError } from '@chainlens/shared-types'

function body(code: string, message: string) {
  return { code, message, error: message }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>()
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      if (typeof payload === 'object' && payload && 'code' in payload) {
        response.status(status).json(payload)
        return
      }
      const message = typeof payload === 'string' ? payload : exception.message
      const code = status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMIT_EXCEEDED' : 'ANALYSIS_INCOMPLETE'
      response.status(status).json(body(code, message))
      return
    }
    if (exception instanceof SecretMaterialError || exception instanceof InvalidAddressError) {
      response.status(HttpStatus.BAD_REQUEST).json(body('INVALID_WALLET_ADDRESS', exception.message))
      return
    }
    if (exception instanceof UnsupportedChainError) {
      response.status(HttpStatus.BAD_REQUEST).json(body('UNSUPPORTED_NETWORK', exception.message))
      return
    }
    if (exception instanceof NotFoundError) {
      const code = exception.message.toLowerCase().includes('transaction') ? 'TRANSACTION_NOT_FOUND' : 'CONTRACT_DATA_UNAVAILABLE'
      response.status(HttpStatus.NOT_FOUND).json(body(code, exception.message))
      return
    }
    if (exception instanceof UpstreamError) {
      response.status(HttpStatus.BAD_GATEWAY).json(body('RPC_UNAVAILABLE', exception.message))
      return
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body('ANALYSIS_INCOMPLETE', 'The analysis could not be completed.'))
  }
}
