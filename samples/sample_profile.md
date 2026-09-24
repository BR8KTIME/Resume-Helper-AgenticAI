# Sample Candidate Profile (Mock Data)

## 1. Education & Core Qualifications
* **Degree**: M.S. in Computer Science & Engineering (GPA 3.9 / 4.3) / B.S. in Computer Science
* **Core Languages**: C/C++17, Python, Go
* **Specialization**: Distributed Systems, Network Protocols (QUIC, TCP), Real-time Media Streaming
* **Language Proficiency**: Fluent English (OPIc AL)

## 2. Core Projects & Research
### [Project A] Distributed Overlay Path Optimization with Local Updates
* **Context**: Global tree updates created severe network overhead during peer churn.
* **Action**: Designed a Q-learning local switching algorithm considering RTT jitter and subtree weight. Ported the logic to Mininet virtual emulation environment and verified within 6% of optimal Gurobi solver path.
* **Result**: Achieved deterministic throughput stabilization with low convergence latency.

### [Project B] Real-Time Async Socket Game Server using Modern C++ (Boost.Asio)
* **Context**: Needed a low-latency 1-on-1 terminal game server supporting concurrent sessions.
* **Action**: Implemented non-blocking async I/O loop using `boost::asio::io_context`. Managed session lifecycle safety via `std::enable_shared_from_this` to eliminate Use-After-Free hazards. Designed a compact 8-byte binary packet protocol to minimize transport payload.
* **Result**: Supported concurrent multi-room matchmaking with thread-safe mutex and condition variable synchronization.
