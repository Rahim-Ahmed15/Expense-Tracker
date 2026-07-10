const express= require('express');
const path = require('path');
const app= express();
const cors= require('cors');
const dotenv= require('dotenv');
dotenv.config();
const schema= require('./models/transaction.model');
const mongoose= require('mongoose');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res)=>{
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

//post request to add transaction
app.post('/api', (req, res)=>{
    const {title, amount, type, category, date, notes}= req.body;
    console.log(req.body);
    const transaction= new schema({
        title,
        amount,
        type,
        category,
        date,
        notes}).save().then((data)=>{
        res.status(200).json({message: "Transaction added successfully", data});
    }).catch((err)=>{
        res.status(500).json({message: "Error adding transaction", err});
    })
})

//get request to get all transactions
app.get('/api', (req, res)=>{
    schema.find().then((data)=>{
        res.status(200).json({message: "Transactions fetched successfully", data});
    }).catch((err)=>{
        res.status(500).json({message: "Error fetching transactions", err});
    })
})

//delete request to delete a transaction
app.delete('/api/:id', (req, res)=>{
    const {id}= req.params;
    schema.findByIdAndDelete(id).then((data)=>{
        res.status(200).json({message: "Transaction deleted successfully", data});
    }).catch((err)=>{
        res.status(500).json({message: "Error deleting transaction", err});
    })})

    mongoose.connect(process.env.MONGO_URL).then(()=>{
    console.log("Connected to MongoDB");
}).catch((err)=>{
    console.log(err);
})

//update request to update a transaction
app.put('/api/:id', (req, res)=>{
    const {id}= req.params;
    const {title, amount, type, category, date, notes}= req.body;
    schema.findByIdAndUpdate(id, {title, amount, type, category, date, notes}, { returnDocument: 'after' }).then((data)=>{
        res.status(200).json({message: "Transaction updated successfully", data});
    }).catch((err)=>{
        res.status(500).json({message: "Error updating transaction", err});
    })
}
)

//search request to search transactions by title
app.get("/api/search", async (req, res) => {
    
  try {
    const { keyword } = req.query;
if (!keyword) {
  return res.status(400).json({
    success: false,
    message: "Keyword is required",
  });
}
    const transactions = await schema.find({
      $or: [
        {
          title: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          category: {
            $regex: keyword,
            $options: "i",
          },
        },
      ],
    });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

//filter request to filter transactions by type and category
app.get("/api/filter", async (req, res) => {
  try {

    const { type, category } = req.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    const transactions = await schema.find(filter);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
});

//get request to get all transactions sorted by date
app.get("/api/sort", async (req, res) => {
  try {
    const { sort } = req.query;

    let sortOption = {};

    switch (sort) {
      case "latest":
        sortOption = { createdAt: -1 };
        break;

      case "oldest":
        sortOption = { createdAt: 1 };
        break;

      case "highest":
        sortOption = { amount: -1 };
        break;

      case "lowest":
        sortOption = { amount: 1 };
        break;

      default:
        sortOption = { createdAt: -1 };
    }

    const transactions = await schema.find().sort(sortOption);

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
});


//pagination request to get transactions by page
app.get("/api/pagination", async (req, res) => {
  try {

    let { page = 1, limit = 5 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const skip = (page - 1) * limit;

    const transactions = await schema
      .find()
      .skip(skip)
      .limit(limit);

    const totalTransactions = await schema.countDocuments();

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(totalTransactions / limit),
      totalTransactions,
      data: transactions,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
});
//get request to get monthly report
app.get("/api/monthly-report", async (req, res) => {
  try {

    const report = await schema.aggregate([
      {
        $group: {
          _id: {
            $month: "$date",
          },

          totalIncome: {
            $sum: {
              $cond: [
                { $eq: ["$type", "income"] },
                "$amount",
                0,
              ],
            },
          },

          totalExpense: {
            $sum: {
              $cond: [
                { $eq: ["$type", "expense"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },

      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: report,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
});
//get request to get category report
app.get("/api/category-report", async (req, res) => {
  try {

    const report = await schema.aggregate([
      {
        $group: {

          _id: "$category",

          totalAmount: {
            $sum: "$amount",
          },

          transactions: {
            $sum: 1,
          },

        },
      },

      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: report,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
});


const port= process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});