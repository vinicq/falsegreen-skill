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

*** Keywords ***
Verify Login Succeeded
    [Documentation]    R2 - named like a verifier, asserts nothing (hollow oracle).
    Log    checking login
    Click    id:next
    # CLEAN: Should Be Equal    ${status}    ok

Empty Keyword
    [Documentation]    C2 - keyword with only settings, no steps.
    [Tags]    helper
    # CLEAN: implement the keyword or remove it
