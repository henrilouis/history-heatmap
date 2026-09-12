import "svelte/elements";

declare module "svelte/elements" {
  interface HTMLButtonAttributes {
    // Chrome supports interest invokers; Svelte's HTML types don't include them yet.
    interestfor?: string | null | undefined;
  }
}
