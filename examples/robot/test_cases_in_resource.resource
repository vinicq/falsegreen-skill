*** Settings ***
Documentation    R3 example - a *** Test Cases *** section inside a .resource file.
...              A .resource holds reusable keywords and variables; a Test Cases
...              section here is invalid and the cases never run. The CLEAN
...              counterpart is a Keywords section, which is what a .resource is for.

*** Test Cases ***
Should Not Be Here
    [Documentation]    R3 - test cases do not belong in a .resource file.
    Should Be Equal    ${a}    ${b}
    # CLEAN: move this case into a .robot file; keep only keywords/variables here

*** Keywords ***
Do A Thing Clean
    [Documentation]    Keywords are the legitimate content of a .resource file.
    Should Be Equal    ${a}    ${b}
