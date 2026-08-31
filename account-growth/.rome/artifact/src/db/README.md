# Database

The app stores completed draft-only weekly plans in the shared Rome SQLite database under the `account_growth` table prefix. Schema changes are defined in `schema.ts` and migrated with `pnpm db:generate`.
