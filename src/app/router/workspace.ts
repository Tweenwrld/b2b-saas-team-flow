import { KindeOrganization, KindeUser } from "@kinde-oss/kinde-auth-nextjs";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { z } from "zod";
import { base } from "../middleware/base";
import { requiredAuthMiddleware } from "../middleware/auth";
import { requiredWorkspaceMiddleware } from "../middleware/workspace";
import { workspaceSchema } from "../schemas/workspace";
import { init, Organizations } from "@kinde/management-api-js";
import { standardSecurityMiddleware } from "../middleware/arcjet/standard";
import { heavyWriteSecurityMiddleware } from "../middleware/arcjet/heavy-write";




export const listWorkspaces = base
.use(requiredAuthMiddleware)
.use(requiredWorkspaceMiddleware)
.route({
    method: "GET",
    path: "/workspace",
    summary: "List all workspaces",
    tags: ["workspace"],
})
.input(z.void())
.output(z.object({
    workspaces: z.array(z.object({
        id: z.string(),
        name: z.string(),
        avatar:z.string(),
    })),
    user: z.custom<KindeUser<Record<string, unknown>>>(),
    currentWorkspace: z.custom<KindeOrganization<unknown>>(),
}))
.handler(async ({ context, errors }) => {
    //useKindeBrowserClient exposes functions running only on the browser(client side)
    const {getUserOrganizations} = getKindeServerSession() //exposes functions running only on server side

    const organizations = await getUserOrganizations();

    if (!organizations) {
        throw errors.FORBIDDEN();
    }

    return {
        workspaces: organizations?.orgs.map((org) => ({
            id: org.code,
            name: org.name ?? "My Workspace",
            avatar: org.name?.charAt(0) ?? "M",
        })),
        user: context.user,
        currentWorkspace: context.workspace,
    };

});


export const createWorkspaces = base
.use(requiredAuthMiddleware)
.use(requiredWorkspaceMiddleware)
.use(standardSecurityMiddleware)
.use(heavyWriteSecurityMiddleware)
.route({
    method: "POST",
    path: "/workspace",
    summary: "Create a new workspace",
    tags: ["workspace"],
})
.input(workspaceSchema)
.output(z.object({
    orgCode: z.string(),
    workspaceName: z.string(),
    })
)

.handler(async ({ context, errors, input }) => {
    init();

    let data;

    try {
        data = await Organizations.createOrganization({
            requestBody: {
                name: input.name,
            }
        })
    } catch (error) {
        console.error('Failed to create organization:', error);
        throw errors.FORBIDDEN({
            message: `Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }

    if (!data.organization?.code) {
        throw errors.FORBIDDEN({
            message: 'Org code is not defined',
        });
    }

    try {
        await Organizations.addOrganizationUsers({
            orgCode: data.organization.code,
            requestBody: {
                users: [
                    {
                        id: context.user.id,
                        roles: ["admin"]
                    },
                ],
            },
        });
    } catch (error) {
        console.error('Failed to add user to organization:', error);
        throw errors.FORBIDDEN({
            message: `Failed to add user to organization: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
    }

    const { refreshTokens } = getKindeServerSession();

    await refreshTokens();

    return {
        orgCode: data.organization.code,
        workspaceName: input.name,
    }
});