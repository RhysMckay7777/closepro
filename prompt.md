Console Error


A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:
- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

See more info here: https://nextjs.org/docs/messages/react-hydration-error


  ...
    <HTTPAccessFallbackErrorBoundary pathname="/" notFound={<SegmentViewNode>} forbidden={undefined} ...>
      <RedirectBoundary>
        <RedirectErrorBoundary router={{...}}>
          <InnerLayoutRouter url="/" tree={[...]} params={{}} cacheNode={{rsc:<Fragment>, ...}} segmentPath={[...]} ...>
            <SegmentViewNode type="page" pagePath="page.tsx">
              <SegmentTrieNode>
              <Home>
                <script>
                <Home>
                  <LandingHeader>
                    <header className="relative z...">
                      <div className="relative m...">
                        <div className="flex h-16 ...">
                          <div>
                          <div className="hidden ite...">
                            <nav>
                            <div>
                            <ThemeSwitcher className="rounded-lg...">
                              <div className="relative i...">
                                <button
                                  aria-label="System theme"
+                                 className="relative h-6 w-6 rounded-full transition-colors bg-secondary"
-                                 className="relative h-6 w-6 rounded-full transition-colors hover:bg-accent"
                                  onClick={function onClick}
                                  type="button"
                                >
                                  <Monitor className="relative z...">
                                    <svg
                                      ref={null}
                                      xmlns="http://www.w3.org/2000/svg"
                                      width={24}
                                      height={24}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
+                                     className="lucide lucide-monitor relative z-10 m-auto h-4 w-4 transition-colors ..."
-                                     className="lucide lucide-monitor relative z-10 m-auto h-4 w-4 transition-colors ..."
                                      aria-hidden="true"
                                    >
                                ...
                            ...
                          <div className="flex items...">
                            <ThemeSwitcher className="rounded-lg...">
                              <div className="relative i...">
                                <button
                                  aria-label="System theme"
+                                 className="relative h-6 w-6 rounded-full transition-colors bg-secondary"
-                                 className="relative h-6 w-6 rounded-full transition-colors hover:bg-accent"
                                  onClick={function onClick}
                                  type="button"
                                >
                                  <Monitor className="relative z...">
                                    <svg
                                      ref={null}
                                      xmlns="http://www.w3.org/2000/svg"
                                      width={24}
                                      height={24}
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
+                                     className="lucide lucide-monitor relative z-10 m-auto h-4 w-4 transition-colors ..."
-                                     className="lucide lucide-monitor relative z-10 m-auto h-4 w-4 transition-colors ..."
                                      aria-hidden="true"
                                    >
                                ...
                            ...
                ...
            ...
          ...
app\page.tsx (47:7) @ Home


  45 |         dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
  46 |       />
> 47 |       <LandingHeader />
     |       ^
  48 |       <main className="relative min-h-screen w-full overflow-hidden scroll-smooth pt-14">
  49 |         {/* Hero */}
  50 |         <section className="relative w-full overflow-hidden bg-white py-12 md:py-20 lg:py-24 dark:bg-black/3">
Call Stack
24

Show 1 ignore-listed frame(s)
createConsoleError
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_f3530cac._.js (2199:71)
handleConsoleError
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_f3530cac._.js (2980:54)
console.error
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_f3530cac._.js (3124:57)
<unknown>
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (3469:25)
runWithFiberInDEV
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (965:74)
emitPendingHydrationWarnings
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (3468:13)
completeWork
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (6897:102)
runWithFiberInDEV
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (965:131)
completeUnitOfWork
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (9627:23)
performUnitOfWork
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (9564:28)
workLoopConcurrentByScheduler
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (9558:58)
renderRootConcurrent
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (9541:71)
performWorkOnRoot
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (9068:150)
performWorkOnRootViaSchedulerTask
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_react-dom_1e674e59._.js (10230:9)
MessagePort.performWorkUntilDeadline
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_next_dist_compiled_a0e4c7b4._.js (2647:64)
svg
<anonymous>
<unknown>
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_dc0ca75d._.js (19090:499)
Monitor
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/node_modules_dc0ca75d._.js (19130:411)
<unknown>
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/_fafb360f._.js (204:229)
Array.map
<anonymous>
ThemeSwitcher
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/_fafb360f._.js (197:26)
LandingHeader
file:///C:/Users/sauba_xqr/Downloads/closepro%20copy/closepro/.next/dev/static/chunks/_fafb360f._.js (965:231)
Home
app\page.tsx (47:7)