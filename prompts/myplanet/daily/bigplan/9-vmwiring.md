an analysis suggested

Refactor Roadmap (High → Low Priority)
1. Finish Cleaning the Data Layer
2. Introduce Global Navigation Architecture
3. Expand ViewModel and Use Layers
4. Complete Dependency Injection Cleanup
5. Consolidate Sync and Upload Workflow
6. Migrate UI Incrementally to Compose
7. Optimize Remaining Performance Hotspots
8. Improve Code Health and Add Tests

based on that tell me all the spots with tasks we should do to accomplish above suggestion
remember we can only review 9.99ish pr s a round/day
Mostly we wanna avoid merge conflicts during this PR review merge round
also this time focus specially on
connecting and cleaning up ViewModel wiring across features
unify how state flows from repositories, use-cases, and UI adapters
check observers, coroutine scopes, and channel usage for redundant plumbing

consider though
di
data layers  (also use our RealmRepository)
diffutil / listadapter (also use our DiffUtils.itemCallback)
viewmodels

No use cases no jetpack stuff
we want low hanging fruits
no complicated stuff with many changes
so it is easily reviewable
also do not add unused code
keep it as granular as possible
