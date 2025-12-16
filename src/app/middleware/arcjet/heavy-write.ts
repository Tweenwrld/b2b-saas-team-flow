import arcjet, { slidingWindow } from "@/lib/arcjet";
import { base } from "../base";
import { KindeUser } from "@kinde-oss/kinde-auth-nextjs";


const buildStandardAj = () =>
    arcjet.withRule(
        slidingWindow({
            mode: "LIVE",
            interval: "5m",
            max: 2,
        })
    )




export const heavyWriteSecurityMiddleware = base
.$context<{ 
    request: Request;
    user: KindeUser<Record<string, unknown>>;
}>()
.middleware(async ({ context, next, errors }) => {
    const decision = await buildStandardAj().protect(context.request, {
        userId: context.user.id,
    });

    if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
            throw errors.RATE_LIMITED({
                message: 'Rate limit exceeded.',
            });
        }


        throw errors.FORBIDDEN({
            message: "Request Blocked!",
        })
    }

    return next();

});

