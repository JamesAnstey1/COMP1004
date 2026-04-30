# COMP1004
Course Work for the module COMP1004

Overview/How to use

1) To start the apllication you first need to create a master password (for the first time only) to be able to enter the vault. This master key is important becase it encrypts the vault. Do NOT forget the master key as you will NOT be able to reset it.

2) To add a new crediential, the user clicks on the add button that opens the modal. They then enter their account details they want to add such as the website/app name, usernmaae, and password. Once the user saves the data, the system will encypt the data and stores it locally in local storage. 

3) All saved credientials appear in the main list where the user can see account names, usersnames and interact with each entry. To reveal a password the user can hover over the password to see what it is.

4) The searh bar allows the user to filter entires instantly by typing part of the account name. This improves usability becuase it helps the user find accounts easier and quickly. 

5) If the user wants to remove a credential, they can either click the delete button to get rid of it instatly or press edit which you would then be able to change the data of that account.

6) You are able to export and import your data in JSON format by the export and import buttons at the top. If you decide to chnage the JSON by removing or adding an account in a text editor then that will refect in the SPA when you import that data back.

7) When the user finishes, they can lock the valt by refreashing the page. Locking the vault ensures no one else can access the data without entering the master password.