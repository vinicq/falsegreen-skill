*** Settings ***
Documentation    Annotated false-green examples for Robot Framework.
...              Each test below maps to a falsegreen-robot / skill code. The
...              clean counterpart is shown in a comment under each case.
Library          Browser
Library          DatabaseLibrary

*** Test Cases ***
Empty Test
    [Documentation]    C2 - no keyword runs, nothing is verified.
    # CLEAN: call the unit and assert: Should Be Equal    ${result}    ${expected}

No Verification Keyword
    [Documentation]    C2b - runs keywords but no Should/verification keyword.
    Open Browser    http://localhost:8080
    Click    id:submit
    # CLEAN: end with a verification - Get Text    h1    ==    Welcome

Always True
    [Documentation]    C5 - the check can never fail.
    Should Be True    ${TRUE}
    # CLEAN: Should Be True    ${count} > 0

Self Compare
    [Documentation]    C7 - both sides are the same value.
    Should Be Equal    ${value}    ${value}
    # CLEAN: Should Be Equal    ${value}    expected

Swallowed Failure
    [Documentation]    C3 - the failure is absorbed and never asserted.
    Run Keyword And Ignore Error    Do Risky Thing
    # CLEAN: ${status}    ${msg}=    Run Keyword And Ignore Error    Do Risky Thing
    #        Should Be Equal    ${status}    PASS

Forced Green
    [Documentation]    R1 - Pass Execution ends the test as passed.
    Pass Execution    skip the real check
    Should Be Equal    ${a}    ${b}
    # CLEAN: remove Pass Execution; let the verification decide

No Operation Only
    [Documentation]    R4 - the only step does nothing.
    No Operation
    # CLEAN: implement the test or delete it

Empty Template Test
    [Documentation]    R5 - templated test with no data rows runs zero cases.
    [Template]    Verify Addition
    # CLEAN: add data rows under the template -> 1    2    3

Hard-Coded Host
    [Documentation]    C23 - a literal IP ties the test to one machine.
    Open Browser    http://10.0.0.5:8080
    Get Text    h1    ==    Welcome
    # CLEAN: read the URL from a variable / environment

Conditional Only Check
    [Documentation]    C21 - the only verification may never run.
    Do Something
    IF    ${ready}
        Should Be Equal    ${a}    ${b}
    END
    # CLEAN: run at least one verification unconditionally

Bare Variable Truthiness
    [Documentation]    C6 - checks a non-boolean variable is merely truthy, not its value.
    ${r}=    Get Status
    Should Be True    ${r}
    # CLEAN: Should Be Equal As Integers    ${r}    200

String Literal True
    [Documentation]    R6 - a non-empty string literal is always truthy.
    Should Be True    login succeeded
    # CLEAN: Should Be True    ${count} > 0

Catch All Expected Error
    [Documentation]    C9 - the glob "*" matches any error, even a typo in the test.
    Run Keyword And Expect Error    *    Do Risky Thing
    # CLEAN: Run Keyword And Expect Error    ValueError: bad input    Do Risky Thing

Status Oracle Disabled
    [Documentation]    C9b - expected_status=any accepts every HTTP status.
    GET    https://api.example.com/users    expected_status=any
    # CLEAN: GET    https://api.example.com/users    expected_status=200

Self Confirming Literal
    [Documentation]    C11a - the expected side is a copy of the actual value.
    ${value}=    Get Value From Sut
    ${expected}=    Set Variable    ${value}
    Should Be Equal    ${value}    ${expected}
    # CLEAN: ${expected}=    Set Variable    42

Vacuous Library Assertion
    [Documentation]    C44 - every string contains the empty string, so it never fails.
    Should Contain    ${text}    ${EMPTY}
    # CLEAN: Should Contain    ${text}    welcome

Captured Value Never Used
    [Documentation]    C31 - the captured heading is dead; the test asserts something else.
    ${heading}=    Get Text    //h1
    Should Be Equal    ${status}    active
    # CLEAN: Should Be Equal    ${heading}    Welcome

Sleep As Synchronization
    [Documentation]    C16 - the result depends on timing, not on a real wait.
    Sleep    2s
    Should Be Equal    ${a}    ${b}
    # CLEAN: Wait Until Element Is Visible    id:result

Skipped Test
    [Documentation]    C32 - robot:skip means the case never runs.
    [Tags]    robot:skip
    Should Be Equal    ${a}    ${b}
    # CLEAN: [Tags]    smoke

Dead After Fail
    [Documentation]    C20 - nothing after Fail runs, so the check is dead.
    Fail    stop here
    Should Be Equal    ${a}    ${b}
    # CLEAN: verify first, then Run Keyword If ${broken} Fail reported

Oracle Switched Off
    [Documentation]    CC - the only verification is commented out.
    Do Something
    # Should Be Equal    ${a}    ${b}
    Log    moving on
    # CLEAN: uncomment the Should Be Equal line

Duplicate Template Row
    [Documentation]    C37 - the second data row repeats the first, adding no coverage.
    [Template]    Verify Addition
    1    2    3
    1    2    3
    4    5    9
    # CLEAN: drop the repeated 1 2 3 row

Hollow Template Test
    [Documentation]    R7 - the in-file template keyword asserts nothing.
    [Template]    Open And Click
    /home    button-1
    /about    button-2
    # CLEAN: template a verifier keyword that ends in a Should

Verifies In Setup
    [Documentation]    R8 - the only oracle is in [Setup]; the body verifies nothing.
    [Setup]    Should Be Equal    ${precondition}    ready
    Log    body runs but verifies nothing
    # CLEAN: move the Should Be Equal into the body

Verifies In Teardown
    [Documentation]    R8b - the only oracle is in [Teardown], a separate axis.
    Do Something
    [Teardown]    Should Be Equal    ${result}    ok
    # CLEAN: assert ${result} in the body; keep only cleanup in teardown

Control Flow At Test Level
    [Documentation]    D2 - IF at the test level (diagnostic, off by default).
    Should Be Equal    ${a}    ${b}
    IF    ${cond}
        Log    branch
    END
    # CLEAN: move the IF into a keyword to keep the case flat

Long Test
    [Documentation]    M2 - too many steps (diagnostic, off by default).
    Log    step 1
    Log    step 2
    Log    step 3
    Log    step 4
    Log    step 5
    Log    step 6
    Log    step 7
    Log    step 8
    Log    step 9
    Log    step 10
    Log    step 11
    Should Be Equal    ${a}    ${b}
    # CLEAN: split into focused cases or extract a keyword

*** Keywords ***
Open And Click
    [Documentation]    R7 - hollow template keyword: acts but never verifies.
    [Arguments]    ${path}    ${selector}
    Go To    ${path}
    Click    ${selector}
    # CLEAN: end with Should Be Equal / Page Should Contain

Verify Login Succeeded
    [Documentation]    R2 - named like a verifier, asserts nothing (hollow oracle).
    Log    checking login
    Click    id:next
    # CLEAN: Should Be Equal    ${status}    ok

Empty Keyword
    [Documentation]    C2 - keyword with only settings, no steps.
    [Tags]    helper
    # CLEAN: implement the keyword or remove it
