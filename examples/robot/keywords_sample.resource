*** Settings ***
Documentation    Annotated false-green examples for a Robot .resource file.
...              A .resource holds reusable keywords and variables - never
...              *** Test Cases ***. The smells here live at the keyword level.

*** Keywords ***
Verify Order Was Created
    [Documentation]    R2 - named like a verifier but asserts nothing (hollow oracle).
    [Arguments]    ${order_id}
    Log    pretending to validate ${order_id}
    # CLEAN: Should Be Equal    ${order.status}    created

Validate Payment
    [Documentation]    C2 - empty keyword (only settings, no steps).
    [Arguments]    ${payment}
    # CLEAN: implement the verification or remove the keyword

Open The App
    [Documentation]    Clean action keyword - not flagged. Only verifier-named
    ...                keywords (Verify/Assert/Validate/Should) must assert.
    Log    opening
    Click    id:start

Check Total Is Correct
    [Documentation]    Clean verifier - asserts an independent expected value.
    [Arguments]    ${total}    ${expected}
    Should Be Equal As Numbers    ${total}    ${expected}
