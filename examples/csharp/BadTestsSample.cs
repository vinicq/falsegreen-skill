using NUnit.Framework;
using Moq;

/// <summary>
/// Examples of false-positive test patterns in C#/NUnit + Moq.
/// Each test passes green but does not verify correct behavior.
/// See reference.md for the case number and judgment.
/// </summary>
[TestFixture]
public class BadTestsSample
{
    // ─── Case 10: Mocks the unit under test ──────────────────────────────

    [Test]
    public void Case10_MocksTheSut()
    {
        var mockCalculator = new Mock<ICalculator>();
        mockCalculator.Setup(c => c.Add(2, 3)).Returns(5);

        // BAD: ICalculator IS the SUT — testing the mock config, not production code
        Assert.That(mockCalculator.Object.Add(2, 3), Is.EqualTo(5));  // C10
    }

    // ─── Case 10 clean ───────────────────────────────────────────────────

    [Test]
    public void Case10_Clean()
    {
        var mockRepo = new Mock<IUserRepository>();
        mockRepo.Setup(r => r.FindById(1)).Returns(new User { Id = 1, Name = "Alice" });

        var sut = new UserService(mockRepo.Object);  // real SUT
        var result = sut.GetUser(1);

        Assert.That(result.Name, Is.EqualTo("Alice"));
    }

    // ─── Case 11: Asserts the value fed to the mock ───────────────────────

    [Test]
    public void Case11_AssertsFedValue()
    {
        var mockRepo = new Mock<IPriceRepository>();
        mockRepo.Setup(r => r.GetBasePrice("SKU-1")).Returns(100m);

        var sut = new PriceService(mockRepo.Object);
        var result = sut.GetPrice("SKU-1");

        // C11 if GetPrice() just returns repo.GetBasePrice()
        Assert.That(result, Is.EqualTo(100m));
    }

    // ─── C# specific: async void test loses exceptions ───────────────────

    // BAD: async void — if an assertion throws, the test runner may not catch it
    // [Test]
    // public async void Case_AsyncVoidTest() { ... }  // use async Task instead

    [Test]
    public async System.Threading.Tasks.Task AsyncTask_IsCorrect()
    {
        // CLEAN: async Task — exceptions propagate correctly
        var result = await FetchDataAsync();
        Assert.That(result, Is.Not.Null);
    }

    // ─── C# specific: Assert.Pass() vacuous pattern ──────────────────────

    [Test]
    public void Case_AssertPass_IsVacuous()
    {
        // BAD: always passes, asserts nothing about production behavior
        Assert.Pass();  // equivalent to assert True in Python
    }

    // Placeholder types
    public interface ICalculator { int Add(int a, int b); }
    public class User { public int Id { get; set; } public string Name { get; set; } = ""; }
    public interface IUserRepository { User FindById(int id); }
    public class UserService {
        private readonly IUserRepository _repo;
        public UserService(IUserRepository repo) { _repo = repo; }
        public User GetUser(int id) => _repo.FindById(id);
    }
    public interface IPriceRepository { decimal GetBasePrice(string sku); }
    public class PriceService {
        private readonly IPriceRepository _repo;
        public PriceService(IPriceRepository repo) { _repo = repo; }
        public decimal GetPrice(string sku) => _repo.GetBasePrice(sku);
    }
    private System.Threading.Tasks.Task<string> FetchDataAsync() =>
        System.Threading.Tasks.Task.FromResult("data");
}
