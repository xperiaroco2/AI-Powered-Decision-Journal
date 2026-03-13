# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - button "Toggle theme" [ref=e5] [cursor=pointer]:
      - img [ref=e6]
    - heading "Create your account" [level=2] [ref=e9]
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Name (optional)
          - textbox "Name (optional)" [ref=e14]:
            - /placeholder: John Doe
        - generic [ref=e15]:
          - generic [ref=e16]: Email address
          - textbox "Email address" [ref=e17]:
            - /placeholder: you@example.com
            - text: testuser@example.com
        - generic [ref=e18]:
          - generic [ref=e19]: Password
          - textbox "Password" [ref=e20]:
            - /placeholder: ••••••••
            - text: password123
          - paragraph [ref=e21]: Must be at least 6 characters
      - generic [ref=e22]: User with this email already exists
      - button "Sign up" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - generic [ref=e26]: Already have an account?
        - link "Sign in" [ref=e27] [cursor=pointer]:
          - /url: /login
  - status [ref=e28]:
    - generic [ref=e29]:
      - img [ref=e31]
      - generic [ref=e33]:
        - text: Static route
        - button "Hide static indicator" [ref=e34] [cursor=pointer]:
          - img [ref=e35]
  - alert [ref=e38]
```