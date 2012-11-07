/* Created By : Brij Mohan Dammani
* http://techbrij.com

*/


/// <reference path="../Scripts/jquery-1.7.2.js" />
/// <reference path="../Scripts/jquery-ui-1.8.20.js" />
/// <reference path="../Scripts/Linq2IndexedDB.js" />
/// <reference path="../Scripts/modernizr-2.5.3.js" />

if (!localStorage.customerRevision) {
    localStorage.customerRevision = -1;
}

var config = {
    dbName: 'CustomerDB',
    version: 1,
    objectStoreName: 'Customers',
    appID: 123
};

var databaseDefinition = [{
    version: config.version,
    objectStores: [{ name: config.objectStoreName, objectStoreOptions: { autoIncrement: false, keyPath: "Email"}}],
    indexes: [{ objectStoreName: config.objectStoreName, propertyName: "Email", indexOptions: { unique: true, multirow: false}}]
}];

var dbConfig = {
    version: config.version,
    definition: databaseDefinition
};
var db = window.linq2indexedDB(config.dbName, dbConfig, false);

$(function () {

    db.initialize().then(function () {
        InitializeData();
    }, handleError);

    $("#dialog-form").dialog({
        autoOpen: false,
        height: 300,
        width: 350,
        modal: true,
        buttons: {
            "Save": function () {
                var bValid = true;

                if (bValid) {
                    var id = parseInt($("#txtId").val());
                    var customer = {};
                    if (id != 0) {
                        customer.CustomerID = id;
                    }
                    customer.Name = $("#txtName").val();
                    customer.Email = $("#txtEmail").val();
                    customer.Phone = $("#txtPhone").val();
                    customer.Revision = -1;
                    customer.IsDeleted = 0;
                    saveCustomer(customer);
                    $(this).dialog("close");
                }
            },
            Cancel: function () {
                $(this).dialog("close");
            }
        },
        close: function () {
        }
    });

    $('#btnAddCustomer').click(function () {
        $("#txtId").val(0);
        $("#txtName").val('');
        $("#txtEmail").val('');
        $("#txtEmail").removeAttr('disabled').css({ 'color': 'black' }); ;
        $("#txtPhone").val('');
        $("#dialog-form").dialog("open");
    });

    $('#btnDeleteDB').click(function () {
        db.deleteDatabase().then(function () {
            db.initialize().then(function () {
                $('#tblCustomer').remove();
                localStorage.customerRevision = -1;
                InitializeData();
            }, handleError);
        });
    });
    $('#btnSyncServer').click(function () {
        var customers = [];
        db.linq.from(config.objectStoreName).select().then(function () {
            if (customers.length > 0) {
                var postData = { revision: parseInt(localStorage.customerRevision, 10), appID: config.appID, customers: customers };
                $.ajax({
                    url: 'api/service',
                    type: 'POST',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify(postData),
                    success: function (data) {
                        if (data.Revision == localStorage.customerRevision) {
                            alert('There is newer version on the server. Please Sync from server first.');
                        }
                        else {
                            syncData(data);                           
                        }
                    }
                });
            }
            else {
                alert('There is no change in data after your last synchronization.');
            }
        }, handleError, function (data) {
            if (data.Revision == -1) {
                customers.push(data);
            }
        });

    });

    $('#btnSyncLocal').click(function () {
        $.ajax({
            url: 'api/service?revision=' + localStorage.customerRevision,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                if (data.Revision == localStorage.customerRevision) {
                    alert('You are already working on the latest version.');
                }
                else {
                    syncData(data);                   
                }
            }
        });
    });
});

function syncData(data) {
    var emails = [];
    db.linq.from(config.objectStoreName).select(["Email"]).then(function () {
        $.each(data.Customers, function () {
            if ($.inArray(this.Email, emails) > -1) {
                //update
                db.linq.from(config.objectStoreName).update(this).then(function (data) {
                }, handleError);
            }
            else {
                //insert
                db.linq.from(config.objectStoreName).insert(this).then(function (data) {
                }, handleError);
            }
        });
        //Rebind Grid
        $('#tblCustomer').remove();
        InitializeData();
        localStorage.customerRevision = data.Revision;
        alert('The synchronization has been completed successfully.');
    }, handleError, function (data) {
        emails.push(data.Email);
    });  
}


function InitializeData() {
    var content = $('#contentHolder');
    var table = $('<table id="tblCustomer" class="ui-widget ui-widget-content"></table>');
    content.append(table);
    var thead = $('<thead></thead>');
    table.append(thead);
    var tr = $('<tr class="ui-widget-header"></tr>');
    thead.append(tr);
    tr.append('<th>Name</th><th>Email</th><th>Phone</th><th>Actions</th>');
    var tbody = $('<tbody id="customer-data"></tbody>');
    table.append(tbody);

    $('#customer-data').empty();
    db.linq.from(config.objectStoreName).where("IsDeleted").equals("0").orderBy("Email").select().then(function () {
    }, handleError, function (sdata) {
        showCustomer(sdata);
    });

}

function saveCustomer(customer) {
    var emails = [];
    //get all localDB emails
    db.linq.from(config.objectStoreName).select(["Email"]).then(function () {
        if ((customer.CustomerID && customer.CustomerID != 0) || $.inArray(customer.Email, emails) > -1) {
            db.linq.from(config.objectStoreName).update(customer).then(function (data) {
                showCustomer(data.object);
            }, handleError);
        } else {
            customer.CustomerID = -1;
            db.linq.from(config.objectStoreName).insert(customer).then(function (data) {
                showCustomer(data.object);
            }, handleError);
        }
    }, handleError, function (data) {
        emails.push(data.Email);
    });
}
function getAllEmails() {


}
function showCustomer(data) {
    var row = $('tr[value="' + data.Email + '"]');
    if (row.length > 0) {
        row.empty();
    } else {
        row = $('<tr value="' + data.Email + '">');
    }
    row.append('<td>' + data.Name + '</td><td>' + data.Email + '</td><td>' + data.Phone + '</td>');
    var upd = $('<button type="button" value="' + data.Email + '">Update</button>');
    upd.button().click(function () {
        getCustomer(this);
    });

    var del = $('<button type="button" value="' + data.Email + '">Delete</button>');
    del.button().click(function () {
        deleteCustomer(this);
    });

    var col = $('<td></td>');
    col.append(upd);
    col.append(del);
    row.append(col);
    $('#customer-data').append(row);
}



function getCustomer(btn) {
    db.linq.from(config.objectStoreName).get($(btn).val()).then(InitializeUpdate, handleError);
}

function deleteCustomer(btn) {

    db.linq.from(config.objectStoreName).get($(btn).val()).then(function (data) {

        if (data.CustomerID == -1) {
            //Delete local record which is not saved on server yet
            db.linq.from(config.objectStoreName).remove(data.Email).then(function () {
                $(btn).parents('tr').remove();
            }, handleError);
        }
        else {
            data.IsDeleted = 1;
            data.Revision = -1;
            db.linq.from(config.objectStoreName).update(data).then(function (data) {
                $(btn).parents('tr').remove();
            }, handleError);
        }
    }, handleError);
}

function InitializeUpdate(customer) {
    $("#txtId").val(customer.CustomerID);
    $("#txtName").val(customer.Name);
    $("#txtEmail").val(customer.Email);
    $("#txtPhone").val(customer.Phone);
    $("#txtEmail").attr('disabled', 'disabled').css({ 'color': 'gray' });

    $("#dialog-form").dialog("open");
}

function handleError(error) {
    alert(error);
}