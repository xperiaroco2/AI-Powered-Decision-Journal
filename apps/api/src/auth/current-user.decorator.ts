import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User Decorator
 *
 * Extracts the authenticated user from the request.
 * Must be used with JwtAuthGuard.
 *
 * Example:
 * @Get()
 * @UseGuards(JwtAuthGuard)
 * async findAll(@CurrentUser() user: { id: string; email: string }) {
 *   return this.service.findAll(user.id);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
